INSERT INTO admission (admission_id,decision_encounter_id,attending_id,room_no,admitted_at,expected_discharge_date,reason) VALUES
    (10,101,12,501,'2026-01-03 10:00:00','2026-01-10','경과 관찰'),
    (20,102,11,502,'2026-01-02 12:00:00',NULL,'검사 대기');
INSERT INTO encounter (encounter_id,patient_id,doctor_id,admission_id,encounter_at,encounter_type,finding) VALUES
    (201,1,11,10,'2026-01-04 10:00:00','입원','검사 요청'),
    (202,1,12,10,'2026-01-05 10:00:00','입원','호전');
INSERT INTO exam_item (exam_code,name,category,fee) VALUES ('LAB','혈액 검사','혈액',10000);
INSERT INTO exam (exam_id,encounter_id,exam_code,requested_at) VALUES
    (1,201,'LAB','2026-01-04 10:00:00'),(2,201,'LAB','2026-01-04 10:00:00'),(3,202,'LAB','2026-01-05 10:00:00'),
    (4,101,'LAB','2026-01-02 10:00:00'),(5,107,'LAB','2026-01-01 11:00:00');
INSERT INTO prescription (prescription_id,encounter_id,dispense_type,prescribed_at) VALUES
    (1,201,'원내','2026-01-04 10:00:00'),(2,202,'원내','2026-01-05 10:00:00'),
    (3,201,'원외','2026-01-04 10:00:00'),(4,101,'원내','2026-01-02 10:00:00'),(5,107,'원내','2026-01-01 11:00:00');
