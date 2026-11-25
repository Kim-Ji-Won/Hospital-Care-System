package com.hospital.backend.admission.dto;

import java.time.LocalDateTime;

public record PendingAdmission(int decisionEncounterId, LocalDateTime decidedAt, PatientSummary patient,
                               int doctorId, String doctorName, String departmentName) {}
