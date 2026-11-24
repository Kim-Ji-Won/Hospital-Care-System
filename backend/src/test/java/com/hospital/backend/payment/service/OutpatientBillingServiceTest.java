package com.hospital.backend.payment.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:outpatient-billing;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=none"
})
@Sql("/payment/outpatient-fixture.sql")
class OutpatientBillingServiceTest {
    @Autowired OutpatientBillingService billing;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcClient jdbc;

    @Test
    void storesAndReturnsUnpaidBillWithCurrentPricesForThisEncounterOnly() {
        Integer id = tx.execute(s -> billing.createForEncounter(1, false));
        assertNotNull(id);
        jdbc.sql("UPDATE drug SET unit_price = 1200").update();
        int matches = jdbc.sql("""
                SELECT COUNT(*) FROM payment WHERE payment_id = ? AND encounter_id = 1
                  AND amount = 31473 AND status = '미결제' AND method IS NULL AND paid_at IS NULL
                  AND created_at IS NOT NULL
                """).param(id).query(Integer.class).single();
        assertEquals(1, matches);
    }

    @Test
    void admissionDecisionAndRoundDoNotCreateSeparateBills() {
        tx.executeWithoutResult(s -> {
            assertNull(billing.createForEncounter(2, true));
            assertNull(billing.createForEncounter(3, false));
        });
        assertEquals(0, paymentCount());
    }

    @Test
    void prohibitsBillingOutsideEncounterTransaction() {
        assertThrows(IllegalTransactionStateException.class, () -> billing.createForEncounter(1, false));
        assertEquals(0, paymentCount());
    }

    @Test
    void failureAfterBillingRollsBackEncounterAndPaymentTogether() {
        assertThrows(IllegalStateException.class, () -> tx.executeWithoutResult(s -> {
            jdbc.sql("INSERT INTO encounter VALUES (4, '외래')").update();
            assertNotNull(billing.createForEncounter(4, false));
            throw new IllegalStateException("진료 저장 실패");
        }));
        assertEquals(0, paymentCount());
        assertEquals(0, jdbc.sql("SELECT COUNT(*) FROM encounter WHERE encounter_id = 4").query(Integer.class).single());
    }

    @Test
    void duplicateBillingIsRejectedAndOriginalBillRemains() {
        tx.executeWithoutResult(s -> billing.createForEncounter(1, false));
        assertThrows(DuplicateKeyException.class,
                () -> tx.executeWithoutResult(s -> billing.createForEncounter(1, false)));
        assertEquals(1, paymentCount());
    }

    private int paymentCount() {
        return jdbc.sql("SELECT COUNT(*) FROM payment").query(Integer.class).single();
    }
}
