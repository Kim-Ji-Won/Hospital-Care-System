package com.hospital.backend.admission.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.time.LocalDateTime;
import java.util.List;

public record AdmissionDetail(@JsonUnwrapped AdmissionView admission, List<Round> rounds, Summary summary) {
    public record Round(int encounterId, LocalDateTime encounterAt, int doctorId, String doctorName, String finding) {}
    public record Summary(int roundCount, int examCount, int inHousePrescriptionCount) {}
}
