package com.hospital.backend.admission.service;

import com.hospital.backend.admission.dto.AdmissionDetail;
import com.hospital.backend.admission.dto.AdmissionView;
import com.hospital.backend.admission.dto.PatientSummary;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AdmissionQueryService {
    private static final String SELECT_ADMISSION = """
            SELECT a.admission_id, a.decision_encounter_id, a.attending_id, s.name AS attending_name,
                   a.room_no, r.ward, a.admitted_at, a.expected_discharge_date, a.discharged_at, a.reason,
                   p.patient_id, p.name, p.birth_date, p.gender
            FROM admission a JOIN encounter e ON e.encounter_id = a.decision_encounter_id
            JOIN patient p ON p.patient_id = e.patient_id JOIN staff s ON s.staff_id = a.attending_id
            JOIN room r ON r.room_no = a.room_no
            """;
    private static final RowMapper<AdmissionView> ADMISSION = (rs, row) -> {
        var patient = new PatientSummary(rs.getInt("patient_id"), rs.getString("name"),
                rs.getObject("birth_date", LocalDate.class), rs.getString("gender"));
        return new AdmissionView(rs.getInt("admission_id"), patient, rs.getInt("decision_encounter_id"),
                rs.getInt("attending_id"), rs.getString("attending_name"), rs.getInt("room_no"), rs.getString("ward"),
                rs.getObject("admitted_at", LocalDateTime.class), rs.getObject("expected_discharge_date", LocalDate.class),
                rs.getObject("discharged_at", LocalDateTime.class), rs.getString("reason"));
    };

    private final JdbcClient jdbc;

    public AdmissionQueryService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    AdmissionView forDecision(int decisionEncounterId) {
        return jdbc.sql(SELECT_ADMISSION + " WHERE a.decision_encounter_id = ?")
                .param(decisionEncounterId).query(ADMISSION).single();
    }

    public List<AdmissionView> list(boolean current) {
        String filter = current ? " WHERE a.discharged_at IS NULL" : "";
        return jdbc.sql(SELECT_ADMISSION + filter + " ORDER BY a.admitted_at, a.admission_id").query(ADMISSION).list();
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AdmissionDetail detail(int admissionId) {
        var admission = jdbc.sql(SELECT_ADMISSION + " WHERE a.admission_id = ?")
                .param(admissionId).query(ADMISSION).optional().orElseThrow(() -> new AdmissionAssignmentException(
                        HttpStatus.NOT_FOUND, "NOT_FOUND", "없는 입원번호입니다.", null));
        var rounds = jdbc.sql("""
                SELECT e.encounter_id, e.encounter_at, e.doctor_id, s.name AS doctor_name, e.finding
                FROM encounter e JOIN staff s ON s.staff_id = e.doctor_id
                WHERE e.admission_id = ? ORDER BY e.encounter_at DESC, e.encounter_id DESC
                """).param(admissionId).query(AdmissionDetail.Round.class).list();

        // 검사와 처방을 따로 세어 한 회진에 여러 건씩 있어도 서로 곱해지지 않게 한다.
        var summary = jdbc.sql("""
                SELECT (SELECT COUNT(*) FROM exam x JOIN encounter e ON e.encounter_id = x.encounter_id
                        WHERE e.admission_id = :id) AS exam_count,
                       (SELECT COUNT(*) FROM prescription p JOIN encounter e ON e.encounter_id = p.encounter_id
                        WHERE e.admission_id = :id AND p.dispense_type = '원내') AS in_house_count
                """).param("id", admissionId).query((rs, row) -> new AdmissionDetail.Summary(
                        rounds.size(), rs.getInt("exam_count"), rs.getInt("in_house_count"))).single();
        return new AdmissionDetail(admission, rounds, summary);
    }
}
