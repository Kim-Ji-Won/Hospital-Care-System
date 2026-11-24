package com.hospital.backend.payment.service;

import com.hospital.backend.payment.service.BillingCalculator.EncounterCharges;
import com.hospital.backend.payment.service.BillingCalculator.PrescriptionLine;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static com.hospital.backend.payment.service.BillingCalculator.DispenseType.*;
import static org.junit.jupiter.api.Assertions.*;

class BillingCalculatorTest {
    private final BillingCalculator calculator = new BillingCalculator();
    private final LocalDate start = LocalDate.of(2026, 11, 5);
    private final EncounterCharges empty = new EncounterCharges(List.of(), List.of());
    private final PrescriptionLine halfWon = new PrescriptionLine(IN_HOUSE, 945, new BigDecimal("0.50"), 1, 1);

    @Test
    void outpatientExampleIncludesRequestedExamsAndExcludesOutsideDrugs() {
        var outside = new PrescriptionLine(OUTSIDE, 1_000, BigDecimal.ONE, 3, 5);
        var visit = new EncounterCharges(List.of(8_000, 15_500), List.of(outside));
        assertEquals(38_500, calculator.outpatient(visit));
    }

    @Test
    void inpatientExampleBillsSixNightsAndOneConsultationAcrossAllRounds() {
        var decision = new EncounterCharges(List.of(15_500), List.of());
        var drug = new PrescriptionLine(IN_HOUSE, 4_200, BigDecimal.ONE, 2, 3);
        var round1 = new EncounterCharges(List.of(8_000), List.of(drug));
        var round2 = new EncounterCharges(List.of(8_000, 12_000), List.of());
        assertEquals(443_700, calculator.inpatient(decision, List.of(round1, round2),
                start, start.plusDays(6), 60_000));
    }

    @Test
    void sameDayDischargeBillsOneRoomDay() {
        assertEquals(75_000, calculator.inpatient(empty, List.of(), start, start, 60_000));
    }

    @Test
    void fractionalMedicationCostsAreCombinedAcrossEncountersBeforeRounding() {
        var visit = new EncounterCharges(List.of(), List.of(halfWon));
        assertEquals(15_473, calculator.outpatient(visit));
        assertEquals(15_945, calculator.inpatient(visit, List.of(visit), start, start, 0));
    }

    @Test
    void invalidStayAndAmountOverflowCannotProduceABill() {
        assertThrows(IllegalArgumentException.class,
                () -> calculator.inpatient(empty, List.of(), start, start.minusDays(1), 60_000));
        assertThrows(ArithmeticException.class, () -> calculator.outpatient(
                new EncounterCharges(List.of(Integer.MAX_VALUE), List.of())));
    }
}
