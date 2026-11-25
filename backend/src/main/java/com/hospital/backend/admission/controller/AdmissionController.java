package com.hospital.backend.admission.controller;

import com.hospital.backend.admission.dto.AdmissionDetail;
import com.hospital.backend.admission.dto.AdmissionView;
import com.hospital.backend.admission.dto.AssignAdmissionRequest;
import com.hospital.backend.admission.dto.PendingAdmission;
import com.hospital.backend.admission.service.AdmissionAssignmentException;
import com.hospital.backend.admission.service.AdmissionAssignmentException.ErrorBody;
import com.hospital.backend.admission.service.AdmissionAssignmentException.Field;
import com.hospital.backend.admission.service.AdmissionAssignmentService;
import com.hospital.backend.admission.service.AdmissionQueryService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.DatabindException;

import java.util.List;

@RestController
@RequestMapping("/api/admissions")
public class AdmissionController {
    private final AdmissionAssignmentService admissions;

    private final AdmissionQueryService queries;

    public AdmissionController(AdmissionAssignmentService admissions, AdmissionQueryService queries) {
        this.queries = queries;
        this.admissions = admissions;
    }

    @ModelAttribute
    void requireClinicalStaff(HttpServletRequest request) {
        var session = request.getSession(false);
        Object role = session == null ? null : session.getAttribute("role");
        if (role == null) {
            throw new AdmissionAssignmentException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "로그인이 필요합니다.", null);
        }
        if (!"의사".equals(role) && !"간호사".equals(role)) {
            throw new AdmissionAssignmentException(HttpStatus.FORBIDDEN, "FORBIDDEN", "입원 관리 권한이 없습니다.", null);
        }
    }

    @GetMapping("/pending")
    public List<PendingAdmission> pending() {
        return admissions.pending();
    }

    @GetMapping
    public List<AdmissionView> list(@RequestParam(required = false) String current) {
        if (current == null || "true".equals(current)) return queries.list(true);
        if ("false".equals(current)) return queries.list(false);
        throw AdmissionAssignmentException.invalid("current", "true 또는 false를 입력하세요.");
    }

    @GetMapping("/{admissionId}")
    public AdmissionDetail detail(@PathVariable String admissionId) {
        try {
            return queries.detail(Integer.parseInt(admissionId));
        } catch (NumberFormatException ex) {
            throw AdmissionAssignmentException.invalid("admissionId", "정수 입원번호를 입력하세요.");
        }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdmissionView assign(@RequestBody @Valid AssignAdmissionRequest request) {
        return admissions.assign(request);
    }

    @ExceptionHandler
    ResponseEntity<ErrorBody> assignmentFailure(AdmissionAssignmentException ex) {
        return ResponseEntity.status(ex.status()).body(ex.error());
    }

    @ExceptionHandler
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ErrorBody invalidFields(MethodArgumentNotValidException ex) {
        var fields = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> new Field(error.getField(), error.getDefaultMessage())).toList();
        return new ErrorBody("VALIDATION_FAILED", "입력값을 확인하세요.", fields, null);
    }

    @ExceptionHandler
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ErrorBody invalidBody(HttpMessageNotReadableException ex) {
        String field = "body";
        if (ex.getCause() instanceof DatabindException cause && !cause.getPath().isEmpty()) {
            field = cause.getPath().getFirst().getPropertyName();
        }
        return new ErrorBody("VALIDATION_FAILED", "입력값을 확인하세요.",
                List.of(new Field(field, "요청 형식을 확인하세요.")), null);
    }
}
