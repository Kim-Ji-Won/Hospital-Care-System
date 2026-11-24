package com.hospital.backend.payment.service;

import com.hospital.backend.encounter.service.EncounterChargeQuery;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

@Service
public class OutpatientBillingService {
    private final BillingCalculator calculator = new BillingCalculator();
    private final JdbcClient jdbc;
    private final EntityManager entityManager;
    private final EncounterChargeQuery charges;

    public OutpatientBillingService(JdbcClient jdbc, EntityManager entityManager, EncounterChargeQuery charges) {
        this.jdbc = jdbc;
        this.entityManager = entityManager;
        this.charges = charges;
    }

    /**
     * 3-1 진료 저장의 마지막 단계. 입원 결정 여부는 진료 행에 저장되지 않으므로
     * 호출자가 요청의 admissionDecided 값을 전달한다. 청구 대상이 아니면 paymentId는 null이다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Integer createForEncounter(int encounterId, boolean admissionDecided) {
        if (admissionDecided) {
            return null;
        }
        // 같은 트랜잭션에서 JPA로 작성한 처방·검사를 JDBC 조회에도 반영한다.
        entityManager.flush();
        String type = jdbc.sql("SELECT encounter_type FROM encounter WHERE encounter_id = ?")
                .param(encounterId).query(String.class).single();
        if ("입원".equals(type)) {
            return null;
        }

        int amount = calculator.outpatient(charges.forEncounter(encounterId));
        // payment.uk_payment_active가 동시 호출에도 두 번째 활성 청구를 거절한다.
        var key = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO payment (encounter_id, amount) VALUES (?, ?)")
                .params(encounterId, amount).update(key, "payment_id");
        return Objects.requireNonNull(key.getKey()).intValue();
    }
}
