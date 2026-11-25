package com.hospital.backend.admission.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record AssignAdmissionRequest(
        @NotNull(message = "결정 진료번호를 입력하세요.") @Positive(message = "양의 정수를 입력하세요.") Integer decisionEncounterId,
        @NotNull(message = "병실번호를 입력하세요.") Integer roomNo,
        @NotNull(message = "주치의번호를 입력하세요.") @Positive(message = "양의 정수를 입력하세요.") Integer attendingId,
        @NotBlank(message = "입원 사유를 입력하세요.") @Size(max = 500, message = "500자 이내로 입력하세요.") String reason,
        LocalDate expectedDischargeDate) {}
