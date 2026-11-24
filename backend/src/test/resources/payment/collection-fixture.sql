DROP ALL OBJECTS;
CREATE TABLE patient(patient_id INT PRIMARY KEY);
CREATE TABLE department(department_code VARCHAR(10) PRIMARY KEY, name VARCHAR(50));
CREATE TABLE staff(staff_id INT PRIMARY KEY, department_code VARCHAR(10));
CREATE TABLE encounter(encounter_id INT PRIMARY KEY, patient_id INT, doctor_id INT, encounter_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, admission_id INT);
CREATE TABLE admission(admission_id INT PRIMARY KEY, decision_encounter_id INT, room_no INT, admitted_at TIMESTAMP, discharged_at TIMESTAMP);
CREATE TABLE payment(payment_id INT PRIMARY KEY, encounter_id INT, amount INT, status VARCHAR(10), method VARCHAR(10), created_at TIMESTAMP, paid_at TIMESTAMP);
CREATE TABLE exam_item(exam_code VARCHAR(10) PRIMARY KEY, name VARCHAR(50));
CREATE TABLE exam(exam_id INT PRIMARY KEY, encounter_id INT, exam_code VARCHAR(10));
CREATE TABLE prescription(prescription_id INT PRIMARY KEY, encounter_id INT, dispense_type VARCHAR(10));
INSERT INTO patient VALUES (1),(2),(3);
INSERT INTO department VALUES ('IM','내과');
INSERT INTO staff VALUES (101,'IM');
INSERT INTO encounter(encounter_id,patient_id,doctor_id,admission_id) VALUES (10,1,101,NULL),(11,1,101,5),(12,1,101,NULL),(20,2,101,NULL);
INSERT INTO admission VALUES (5,10,501,'2026-11-24 10:00:00','2026-11-24 19:00:00');
INSERT INTO exam_item VALUES ('X','X선'),('B','혈액검사');
INSERT INTO exam VALUES (1,10,'X'),(2,11,'B'),(3,20,'B');
INSERT INTO prescription VALUES (1,11,'원내'),(2,10,'원외');
INSERT INTO payment VALUES
 (30,10,75000,'취소','카드','2026-11-24 19:00:00','2026-11-24 19:01:00'),
 (31,10,78000,'미결제',NULL,'2026-11-24 19:05:00',NULL),
 (32,12,15000,'완료','현금','2026-11-24 20:00:00','2026-11-24 20:01:00'),
 (40,20,20000,'미결제',NULL,'2026-11-24 21:00:00',NULL);
