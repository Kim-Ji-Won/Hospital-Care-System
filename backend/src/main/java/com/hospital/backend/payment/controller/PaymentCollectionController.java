package com.hospital.backend.payment.controller;

import com.hospital.backend.payment.service.PaymentCollectionService;
import com.hospital.backend.payment.service.PaymentCollectionService.CollectionException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
public class PaymentCollectionController {
    private static final Set<String> METHODS = Set.of("카드", "현금", "계좌이체");
    private final PaymentCollectionService payments;

    public PaymentCollectionController(PaymentCollectionService payments) {
        this.payments = payments;
    }

    @GetMapping("/api/payments")
    public ResponseEntity<?> forPatient(HttpServletRequest request,
                                        @RequestParam(required = false) String patientId) {
        var denied = authorize(request.getSession(false), "원무");
        if (denied != null) return denied;
        Integer id = positiveId(patientId);
        if (id == null) return invalid("patientId", "양의 정수 환자번호가 필요합니다.");
        return ResponseEntity.ok(payments.forPatient(id));
    }

    @GetMapping("/api/me/payments")
    public ResponseEntity<?> mine(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        var denied = authorize(session, "환자");
        if (denied != null) return denied;
        if (!(session.getAttribute("patientId") instanceof Integer patientId)) return unauthenticated();
        return ResponseEntity.ok(payments.forPatient(patientId));
    }

    public record PayRequest(String method) {}

    @PostMapping("/api/payments/{paymentId}/pay")
    public ResponseEntity<?> pay(HttpServletRequest request, @PathVariable String paymentId,
                                 @RequestBody(required = false) PayRequest body) {
        var denied = authorize(request.getSession(false), "원무");
        if (denied != null) return denied;
        Integer id = positiveId(paymentId);
        if (id == null) return invalid("paymentId", "양의 정수 결제번호가 필요합니다.");
        if (body == null || body.method() == null || !METHODS.contains(body.method())) {
            return invalid("method", "카드, 현금, 계좌이체 중 하나를 선택하세요.");
        }
        return ResponseEntity.ok(payments.pay(id, body.method()));
    }

    private static Integer positiveId(String value) {
        try {
            int id = Integer.parseInt(value);
            return id > 0 ? id : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static ResponseEntity<?> authorize(HttpSession session, String role) {
        if (session == null || session.getAttribute("role") == null) return unauthenticated();
        if (!role.equals(session.getAttribute("role"))) {
            return error(403, "FORBIDDEN", "권한이 없습니다.", null);
        }
        return null;
    }

    private static ResponseEntity<?> unauthenticated() {
        return error(401, "UNAUTHENTICATED", "로그인이 필요합니다.", null);
    }

    @ExceptionHandler(CollectionException.class)
    ResponseEntity<?> collectionFailure(CollectionException ex) {
        return switch (ex.reason) {
            case NOT_FOUND -> error(404, "NOT_FOUND", "대상을 찾을 수 없습니다.", null);
            case INVALID_STATUS -> error(409, "INVALID_STATUS", "미결제 상태에서만 수납할 수 있습니다.", null);
        };
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<?> invalidBody() {
        return invalid("method", "결제수단을 확인하세요.");
    }

    private record FieldError(String field, String reason) {}
    private record ErrorBody(String code, String message, List<FieldError> fields, Object details) {}

    private static ResponseEntity<?> invalid(String field, String reason) {
        return error(400, "VALIDATION_FAILED", "입력값을 확인하세요.", List.of(new FieldError(field, reason)));
    }

    private static ResponseEntity<?> error(int status, String code, String message, List<FieldError> fields) {
        return ResponseEntity.status(status).body(new ErrorBody(code, message, fields, null));
    }
}
