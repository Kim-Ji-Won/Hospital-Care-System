package com.hospital.backend.admission.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record AdmissionView(int admissionId, PatientSummary patient, int decisionEncounterId,
                            int attendingId, String attendingName, int roomNo, String ward,
                            LocalDateTime admittedAt, LocalDate expectedDischargeDate,
                            LocalDateTime dischargedAt, String reason) {}
