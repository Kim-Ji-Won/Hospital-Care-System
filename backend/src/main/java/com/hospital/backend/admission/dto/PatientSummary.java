package com.hospital.backend.admission.dto;

import java.time.LocalDate;

public record PatientSummary(int patientId, String name, LocalDate birthDate, String gender) {}
