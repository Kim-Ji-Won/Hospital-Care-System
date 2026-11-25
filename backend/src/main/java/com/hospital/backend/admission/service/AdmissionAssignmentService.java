package com.hospital.backend.admission.service;

import com.hospital.backend.admission.dto.AdmissionView;
import com.hospital.backend.admission.dto.AssignAdmissionRequest;
import com.hospital.backend.admission.dto.PatientSummary;
import com.hospital.backend.admission.dto.PendingAdmission;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class AdmissionAssignmentService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final String PENDING = """
            e.encounter_type = '외래'
            AND NOT EXISTS (SELECT 1 FROM payment b WHERE b.encounter_id = e.encounter_id AND b.status <> '취소')
            AND NOT EXISTS (SELECT 1 FROM admission a WHERE a.decision_encounter_id = e.encounter_id)
            """;
    private final JdbcClient jdbc;

    public AdmissionAssignmentService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<PendingAdmission> pending() {
        return jdbc.sql("""
                SELECT e.encounter_id, e.encounter_at, p.patient_id, p.name, p.birth_date, p.gender,
                       s.staff_id, s.name AS doctor_name, d.name AS department_name
                FROM encounter e JOIN patient p ON p.patient_id = e.patient_id
                JOIN staff s ON s.staff_id = e.doctor_id JOIN department d ON d.department_code = s.department_code
                WHERE
                """ + PENDING + " ORDER BY e.encounter_at, e.encounter_id")
                .query((rs, row) -> new PendingAdmission(rs.getInt("encounter_id"),
                        rs.getObject("encounter_at", LocalDateTime.class), patient(rs), rs.getInt("staff_id"),
                        rs.getString("doctor_name"), rs.getString("department_name"))).list();
    }

    public record ActiveAdmission(int admissionId, int roomNo, LocalDateTime admittedAt) {}

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AdmissionView assign(AssignAdmissionRequest request) {
        // 모든 배정은 환자 → 병실 순서로 잠근다. 대기했던 요청은 두 잠금을 얻은 뒤 최신 상태를 읽는다.
        int patientId = jdbc.sql("""
                SELECT patient_id FROM patient
                WHERE patient_id = (SELECT patient_id FROM encounter WHERE encounter_id = ?) FOR UPDATE
                """).param(request.decisionEncounterId()).query(Integer.class).optional().orElseThrow(this::notFound);
        int capacity = jdbc.sql("SELECT bed_count FROM room WHERE room_no = ? FOR UPDATE")
                .param(request.roomNo()).query(Integer.class).optional().orElseThrow(this::notFound);

        String job = jdbc.sql("SELECT job_type FROM staff WHERE staff_id = ?")
                .param(request.attendingId()).query(String.class).optional().orElseThrow(this::notFound);
        if (!"의사".equals(job)) {
            throw AdmissionAssignmentException.invalid("attendingId", "주치의는 의사만 맡을 수 있습니다.");
        }
        int pending = jdbc.sql("SELECT COUNT(*) FROM encounter e WHERE e.encounter_id = ? AND " + PENDING)
                .param(request.decisionEncounterId()).query(Integer.class).single();
        if (pending == 0) {
            throw new AdmissionAssignmentException(CONFLICT, "INVALID_STATUS", "배정 대기인 진료가 아닙니다.", null);
        }
        var active = jdbc.sql("""
                SELECT a.admission_id, a.room_no, a.admitted_at FROM admission a
                JOIN encounter e ON e.encounter_id = a.decision_encounter_id
                WHERE e.patient_id = ? AND a.discharged_at IS NULL
                """).param(patientId).query(ActiveAdmission.class).optional();
        if (active.isPresent()) {
            throw new AdmissionAssignmentException(CONFLICT, "ALREADY_ADMITTED", "이미 입원 중인 환자입니다.", active.get());
        }
        int occupied = jdbc.sql("SELECT COUNT(*) FROM admission WHERE room_no = ? AND discharged_at IS NULL")
                .param(request.roomNo()).query(Integer.class).single();
        if (occupied >= capacity) {
            throw new AdmissionAssignmentException(CONFLICT, "ROOM_FULL", "빈 병상이 없습니다.", null);
        }

        LocalDateTime admittedAt = LocalDateTime.now(SEOUL).withNano(0);
        if (request.expectedDischargeDate() != null && request.expectedDischargeDate().isBefore(admittedAt.toLocalDate())) {
            throw AdmissionAssignmentException.invalid("expectedDischargeDate", "퇴원 예정일은 오늘부터 지정할 수 있습니다.");
        }
        jdbc.sql("""
                INSERT INTO admission(decision_encounter_id, attending_id, room_no, admitted_at, expected_discharge_date, reason)
                VALUES (?, ?, ?, ?, ?, ?)
                """).param(request.decisionEncounterId()).param(request.attendingId()).param(request.roomNo())
                .param(admittedAt).param(request.expectedDischargeDate()).param(request.reason().strip()).update();

        return jdbc.sql("""
                SELECT a.*, p.patient_id, p.name, p.birth_date, p.gender, s.name AS attending_name, r.ward
                FROM admission a JOIN encounter e ON e.encounter_id = a.decision_encounter_id
                JOIN patient p ON p.patient_id = e.patient_id JOIN staff s ON s.staff_id = a.attending_id
                JOIN room r ON r.room_no = a.room_no WHERE a.decision_encounter_id = ?
                """).param(request.decisionEncounterId()).query((rs, row) -> new AdmissionView(
                        rs.getInt("admission_id"), patient(rs), rs.getInt("decision_encounter_id"),
                        rs.getInt("attending_id"), rs.getString("attending_name"), rs.getInt("room_no"), rs.getString("ward"),
                        rs.getObject("admitted_at", LocalDateTime.class), rs.getObject("expected_discharge_date", LocalDate.class),
                        rs.getObject("discharged_at", LocalDateTime.class), rs.getString("reason"))).single();
    }

    private static PatientSummary patient(ResultSet rs) throws SQLException {
        return new PatientSummary(rs.getInt("patient_id"), rs.getString("name"),
                rs.getObject("birth_date", LocalDate.class), rs.getString("gender"));
    }

    private AdmissionAssignmentException notFound() {
        return new AdmissionAssignmentException(NOT_FOUND, "NOT_FOUND", "없는 진료·병실·의료진입니다.", null);
    }
}
