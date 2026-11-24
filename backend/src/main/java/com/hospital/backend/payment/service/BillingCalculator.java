package com.hospital.backend.payment.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** 청구 생성 시점의 단가로 payment.amount에 저장할 원 단위 금액을 계산한다. */
public final class BillingCalculator {
    private static final int CONSULTATION_FEE = 15_000;

    public enum DispenseType { IN_HOUSE, OUTSIDE }

    public record PrescriptionLine(DispenseType type, int unitPrice, BigDecimal dose,
                                   int timesPerDay, int days) {
        public PrescriptionLine {
            if (type == null || unitPrice < 0 || dose == null || dose.signum() <= 0
                    || timesPerDay <= 0 || days <= 0) {
                throw new IllegalArgumentException("처방 구분·단가·투약 정보를 확인하세요.");
            }
        }

        BigDecimal hospitalCharge() {
            if (type == DispenseType.OUTSIDE) {
                return BigDecimal.ZERO;
            }
            return dose.multiply(BigDecimal.valueOf(unitPrice))
                    .multiply(BigDecimal.valueOf(timesPerDay))
                    .multiply(BigDecimal.valueOf(days));
        }
    }

    /** 해당 진료에서 요청한 모든 검사와 처방상세. 검사 상태로 걸러내지 않는다. */
    public record EncounterCharges(List<Integer> requestedExamFees, List<PrescriptionLine> prescriptions) {
        public EncounterCharges {
            requestedExamFees = List.copyOf(requestedExamFees);
            prescriptions = List.copyOf(prescriptions);
            if (requestedExamFees.stream().anyMatch(fee -> fee < 0)) {
                throw new IllegalArgumentException("검사비는 음수일 수 없습니다.");
            }
        }

        BigDecimal variableCharges() {
            BigDecimal total = BigDecimal.ZERO;
            for (int fee : requestedExamFees) {
                total = total.add(BigDecimal.valueOf(fee));
            }
            for (PrescriptionLine line : prescriptions) {
                total = total.add(line.hospitalCharge());
            }
            return total;
        }
    }

    public int outpatient(EncounterCharges encounter) {
        return toWon(BigDecimal.valueOf(CONSULTATION_FEE).add(encounter.variableCharges()));
    }

    public int inpatient(EncounterCharges decisionEncounter, List<EncounterCharges> rounds,
                         LocalDate admittedOn, LocalDate dischargedOn, int dailyRoomFee) {
        if (dischargedOn.isBefore(admittedOn) || dailyRoomFee < 0) {
            throw new IllegalArgumentException("입퇴원 날짜와 병실 단가를 확인하세요.");
        }
        long days = Math.max(1, ChronoUnit.DAYS.between(admittedOn, dischargedOn));
        BigDecimal roomCharge = BigDecimal.valueOf(dailyRoomFee).multiply(BigDecimal.valueOf(days));
        BigDecimal total = BigDecimal.valueOf(CONSULTATION_FEE)
                .add(decisionEncounter.variableCharges()).add(roomCharge);
        for (EncounterCharges round : rounds) {
            total = total.add(round.variableCharges());
        }
        return toWon(total);
    }

    private static int toWon(BigDecimal total) {
        // 약제비만 소수가 될 수 있다. 진료별 중간 반올림 없이 청구 전체에서 한 번만 반올림한다.
        return total.setScale(0, RoundingMode.HALF_UP).intValueExact();
    }
}
