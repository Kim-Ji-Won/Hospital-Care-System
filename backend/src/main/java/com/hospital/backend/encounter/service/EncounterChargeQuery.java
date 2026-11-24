package com.hospital.backend.encounter.service;

import com.hospital.backend.payment.service.BillingCalculator.DispenseType;
import com.hospital.backend.payment.service.BillingCalculator.EncounterCharges;
import com.hospital.backend.payment.service.BillingCalculator.PrescriptionLine;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** 진료별 요청 검사와 원내 처방상세를 청구 시점의 단가로 조회한다. */
@Service
public class EncounterChargeQuery {
    private final JdbcClient jdbc;

    public EncounterChargeQuery(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public EncounterCharges forEncounter(int encounterId) {
        var fees = jdbc.sql("""
                SELECT i.fee FROM exam e
                JOIN exam_item i ON i.exam_code = e.exam_code
                WHERE e.encounter_id = ?
                """).param(encounterId).query(Integer.class).list();
        var prescriptions = jdbc.sql("""
                SELECT d.unit_price, i.dose, i.times_per_day, i.duration_days
                FROM prescription p
                JOIN prescription_item i ON i.prescription_id = p.prescription_id
                JOIN drug d ON d.drug_code = i.drug_code
                WHERE p.encounter_id = ? AND p.dispense_type = '원내'
                """).param(encounterId).query((rs, index) -> new PrescriptionLine(
                DispenseType.IN_HOUSE, rs.getInt("unit_price"), rs.getBigDecimal("dose"),
                rs.getInt("times_per_day"), rs.getInt("duration_days"))).list();
        return new EncounterCharges(fees, prescriptions);
    }
}
