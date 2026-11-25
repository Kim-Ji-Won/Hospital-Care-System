package com.hospital.backend.admission.service;

import org.springframework.http.HttpStatus;

import java.util.List;

public class AdmissionAssignmentException extends RuntimeException {
    public record Field(String field, String reason) {}
    public record ErrorBody(String code, String message, List<Field> fields, Object details) {}

    private final HttpStatus status;
    private final ErrorBody error;

    public AdmissionAssignmentException(HttpStatus status, String code, String message, Object details) {
        this(status, new ErrorBody(code, message, null, details));
    }

    private AdmissionAssignmentException(HttpStatus status, ErrorBody error) {
        super(error.message());
        this.status = status;
        this.error = error;
    }

    public static AdmissionAssignmentException invalid(String field, String reason) {
        return new AdmissionAssignmentException(HttpStatus.BAD_REQUEST,
                new ErrorBody("VALIDATION_FAILED", "입력값을 확인하세요.", List.of(new Field(field, reason)), null));
    }

    public HttpStatus status() { return status; }
    public ErrorBody error() { return error; }
}
