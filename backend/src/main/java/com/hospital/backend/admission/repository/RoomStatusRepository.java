package com.hospital.backend.admission.repository;

import com.hospital.backend.admission.dto.RoomStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class RoomStatusRepository {
    private final JdbcClient jdbc;

    public RoomStatusRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<RoomStatus> findRooms(boolean availableOnly) {
        String sql = """
                SELECT r.room_no, r.ward, r.bed_count, COUNT(a.admission_id) AS occupied_beds, r.daily_fee
                FROM room r
                LEFT JOIN admission a ON a.room_no = r.room_no AND a.discharged_at IS NULL
                GROUP BY r.room_no, r.ward, r.bed_count, r.daily_fee
                """ + (availableOnly ? " HAVING COUNT(a.admission_id) < r.bed_count" : "")
                + " ORDER BY r.room_no";

        return jdbc.sql(sql).query((row, index) -> new RoomStatus(
                row.getInt("room_no"), row.getString("ward"), row.getInt("bed_count"),
                row.getInt("occupied_beds"), row.getInt("daily_fee"))).list();
    }
}
