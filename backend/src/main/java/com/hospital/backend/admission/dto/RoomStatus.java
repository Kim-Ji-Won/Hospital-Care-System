package com.hospital.backend.admission.dto;

public record RoomStatus(int roomNo, String ward, int bedCount, int occupiedBeds, int dailyFee) {}
