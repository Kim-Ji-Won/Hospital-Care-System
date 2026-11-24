package com.hospital.backend.payment.service;

import com.hospital.backend.payment.dto.PaymentView;
import com.hospital.backend.payment.dto.PaymentView.Admission;
import com.hospital.backend.payment.dto.PaymentView.Includes;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class PaymentCollectionService {
    private final JdbcClient jdbc;

    public PaymentCollectionService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public enum Failure { NOT_FOUND, INVALID_STATUS }

    public static class CollectionException extends RuntimeException {
        public final Failure reason;
        CollectionException(Failure reason) {
            super(reason.name());
            this.reason = reason;
        }
    }

    @Transactional(readOnly = true)
    public List<PaymentView> forPatient(int patientId) {
        if (!jdbc.sql("SELECT patient_id FROM patient WHERE patient_id = ?")
                .param(patientId).query(Integer.class).optional().isPresent()) {
            throw new CollectionException(Failure.NOT_FOUND);
        }
        return readPayments("e.patient_id = :id", patientId);
    }

    @Transactional
    public PaymentView pay(int paymentId, String method) {
        // 한 UPDATE가 상태 확인과 수납을 함께 수행하므로 동시에 온 두 요청 중 하나만 성공한다.
        int changed = jdbc.sql("""
                UPDATE payment SET status = '완료', method = ?, paid_at = ?
                WHERE payment_id = ? AND status = '미결제'
                """).params(method, LocalDateTime.now(ZoneId.of("Asia/Seoul")).withNano(0), paymentId).update();
        if (changed == 0) {
            boolean exists = jdbc.sql("SELECT payment_id FROM payment WHERE payment_id = ?")
                    .param(paymentId).query(Integer.class).optional().isPresent();
            throw new CollectionException(exists ? Failure.INVALID_STATUS : Failure.NOT_FOUND);
        }
        return readPayments("p.payment_id = :id", paymentId).getFirst();
    }

    // 같은 진료의 취소 이력·재청구가 있어도 검사나 처방 건수가 곱해지지 않도록 진료 단위로 집계한다.
    private List<PaymentView> readPayments(String filter, int id) {
        String selected = """
                WITH bills AS (
                    SELECT p.*, e.encounter_at, d.name AS department_name, a.admission_id,
                           a.room_no, a.admitted_at, a.discharged_at
                    FROM payment p JOIN encounter e ON e.encounter_id = p.encounter_id
                    JOIN staff s ON s.staff_id = e.doctor_id
                    JOIN department d ON d.department_code = s.department_code
                    LEFT JOIN admission a ON a.decision_encounter_id = e.encounter_id
                    WHERE %s
                ), visits AS (
                    SELECT DISTINCT encounter_id AS root_id, encounter_id AS visit_id FROM bills
                    UNION
                    SELECT b.encounter_id, r.encounter_id FROM bills b
                    JOIN encounter r ON r.admission_id = b.admission_id
                )
                """.formatted(filter);
        Map<Integer, List<String>> exams = new HashMap<>();
        jdbc.sql(selected + """
                SELECT v.root_id, i.name FROM visits v JOIN exam x ON x.encounter_id = v.visit_id
                JOIN exam_item i ON i.exam_code = x.exam_code ORDER BY x.exam_id
                """).param("id", id).query((rs, n) -> Map.entry(rs.getInt("root_id"), rs.getString("name")))
                .list().forEach(exam -> exams.computeIfAbsent(exam.getKey(), k -> new ArrayList<>()).add(exam.getValue()));

        return jdbc.sql(selected + """
                SELECT b.*, (SELECT COUNT(*) FROM visits v WHERE v.root_id = b.encounter_id) - 1 AS rounds,
                       COALESCE(rx.inside_count, 0) AS inside_count, COALESCE(rx.outside_count, 0) AS outside_count
                FROM bills b LEFT JOIN (
                    SELECT v.root_id, SUM(CASE WHEN p.dispense_type = '원내' THEN 1 ELSE 0 END) AS inside_count,
                           SUM(CASE WHEN p.dispense_type = '원외' THEN 1 ELSE 0 END) AS outside_count
                    FROM visits v JOIN prescription p ON p.encounter_id = v.visit_id GROUP BY v.root_id
                ) rx ON rx.root_id = b.encounter_id
                ORDER BY b.created_at DESC, b.payment_id DESC
                """).param("id", id).query((rs, n) -> toView(rs, exams)).list();
    }

    private PaymentView toView(ResultSet rs, Map<Integer, List<String>> exams) throws SQLException {
        int encounterId = rs.getInt("encounter_id");
        Integer admissionId = rs.getObject("admission_id", Integer.class);
        Admission admission = null;
        Long days = null;
        if (admissionId != null) {
            admission = new Admission(admissionId, rs.getInt("room_no"),
                    rs.getObject("admitted_at", LocalDateTime.class), rs.getObject("discharged_at", LocalDateTime.class));
            days = Math.max(1, ChronoUnit.DAYS.between(admission.admittedAt().toLocalDate(),
                    admission.dischargedAt().toLocalDate()));
        }
        var includes = new Includes(1, exams.getOrDefault(encounterId, List.of()), rs.getInt("inside_count"),
                rs.getInt("outside_count") > 0, rs.getInt("rounds"), days);
        return new PaymentView(rs.getInt("payment_id"), encounterId, admission == null ? "외래" : "입원",
                rs.getInt("amount"), rs.getString("status"), rs.getString("method"),
                rs.getObject("created_at", LocalDateTime.class), rs.getObject("paid_at", LocalDateTime.class),
                rs.getObject("encounter_at", LocalDateTime.class), rs.getString("department_name"), admission, includes);
    }
}
