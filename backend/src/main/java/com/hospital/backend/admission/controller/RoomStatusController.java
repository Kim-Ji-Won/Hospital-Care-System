package com.hospital.backend.admission.controller;

import com.hospital.backend.admission.repository.RoomStatusRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.SessionAttribute;

import java.util.List;

@RestController
public class RoomStatusController {
    private final RoomStatusRepository rooms;

    public RoomStatusController(RoomStatusRepository rooms) {
        this.rooms = rooms;
    }

    @GetMapping("/api/rooms")
    public ResponseEntity<?> list(@SessionAttribute(name = "role", required = false) String role,
                                  @RequestParam(name = "available", required = false) String available) {
        if (role == null) {
            return ResponseEntity.status(401).body(new ErrorBody("UNAUTHENTICATED", "로그인이 필요합니다.", null, null));
        }
        if (!"의사".equals(role) && !"간호사".equals(role)) {
            return ResponseEntity.status(403).body(new ErrorBody("FORBIDDEN", "병실 조회 권한이 없습니다.", null, null));
        }
        if (available != null && !available.equals("true") && !available.equals("false")) {
            return ResponseEntity.badRequest().body(new ErrorBody("VALIDATION_FAILED", "입력값을 확인하세요.",
                    List.of(new FieldError("available", "true 또는 false를 입력하세요.")), null));
        }
        return ResponseEntity.ok(rooms.findRooms("true".equals(available)));
    }

    private record FieldError(String field, String reason) {}
    private record ErrorBody(String code, String message, List<FieldError> fields, Object details) {}
}
