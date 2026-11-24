package com.hospital.backend.payment.dto;

import java.time.LocalDateTime;
import java.util.List;

public record PaymentView(int paymentId, int encounterId, String billingType, int amount,
                          String status, String method, LocalDateTime createdAt, LocalDateTime paidAt,
                          LocalDateTime encounterAt, String departmentName, Admission admission,
                          Includes includes) {
    public record Admission(int admissionId, int roomNo, LocalDateTime admittedAt, LocalDateTime dischargedAt) {}
    public record Includes(int consultationCount, List<String> examNames, int inHousePrescriptionCount,
                           boolean hasOutsidePrescription, int roundCount, Long admissionDays) {}
}
