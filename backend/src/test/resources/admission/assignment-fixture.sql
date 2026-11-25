DELETE FROM payment;
DELETE FROM encounter WHERE encounter_type = '입원';
DELETE FROM admission;
DELETE FROM encounter;
DELETE FROM reservation;
DELETE FROM schedule;
DELETE FROM room;
DELETE FROM staff;
DELETE FROM department;
DELETE FROM patient;

INSERT INTO patient (patient_id, name, birth_date, gender, phone) VALUES
    (1,'환자하나','1990-01-02','여','010-0000-0001'),(2,'환자둘','1980-02-03','남','010-0000-0002');
INSERT INTO department (department_code, name) VALUES ('IM','내과');
INSERT INTO staff (staff_id,department_code,name,phone,job_type,login_id,password_hash) VALUES
    (11,'IM','결정의','1','의사','doctor1','test'),(12,'IM','담당의','2','의사','doctor2','test'),
    (13,'IM','간호사','3','간호사','nurse1','test');
INSERT INTO room (room_no,ward,bed_count,daily_fee) VALUES (501,'5층',1,60000),(502,'5층',2,60000);
INSERT INTO schedule (schedule_id,doctor_id,day_of_week,start_time,end_time,slot_minutes)
    VALUES (1,11,'월','09:00:00','18:00:00',20);
INSERT INTO reservation (reservation_id,patient_id,schedule_id,appointment_at) VALUES
    (1,1,1,'2026-01-02 10:00:00'),(2,2,1,'2026-01-02 09:00:00'),(3,1,1,'2026-01-03 11:00:00'),
    (4,2,1,'2026-01-02 14:00:00'),(5,2,1,'2026-01-02 15:00:00'),(6,1,1,'2026-01-01 09:00:00');
INSERT INTO encounter (encounter_id,patient_id,doctor_id,reservation_id,encounter_at,encounter_type,finding) VALUES
    (101,1,11,1,'2026-01-02 10:00:00','외래','입원 결정'),(102,2,11,2,'2026-01-02 09:00:00','외래','입원 결정'),
    (103,1,11,3,'2026-01-03 11:00:00','외래','입원 결정'),(104,2,11,4,'2026-01-02 14:00:00','외래','일반 외래'),
    (105,2,11,5,'2026-01-02 15:00:00','외래','일반 외래'),(106,1,11,6,'2026-01-01 09:00:00','외래','과거 입원');
INSERT INTO admission (admission_id,decision_encounter_id,attending_id,room_no,admitted_at,discharged_at,reason)
    VALUES (1,106,12,501,'2026-01-01 10:00:00','2026-01-01 16:00:00','과거 입원');
INSERT INTO encounter (encounter_id,patient_id,doctor_id,admission_id,encounter_at,encounter_type,finding)
    VALUES (107,1,12,1,'2026-01-01 11:00:00','입원','회진');
INSERT INTO payment (payment_id,encounter_id,amount,status,method,paid_at) VALUES
    (1,101,15000,'취소','카드','2026-01-02 10:05:00'),(2,104,15000,'미결제',NULL,NULL),
    (3,105,15000,'완료','현금','2026-01-02 15:10:00');
