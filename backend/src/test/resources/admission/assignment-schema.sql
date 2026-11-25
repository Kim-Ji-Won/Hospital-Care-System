CREATE TABLE department (department_code VARCHAR(10) PRIMARY KEY, name VARCHAR(50));
CREATE TABLE staff (staff_id INT PRIMARY KEY, department_code VARCHAR(10), name VARCHAR(50), phone VARCHAR(20),
                    job_type VARCHAR(10), login_id VARCHAR(20), password_hash VARCHAR(255));
CREATE TABLE patient (patient_id INT PRIMARY KEY, name VARCHAR(50), birth_date DATE, gender CHAR(1), phone VARCHAR(20));
CREATE TABLE room (room_no INT PRIMARY KEY, ward VARCHAR(20), bed_count INT, daily_fee INT);
CREATE TABLE schedule (schedule_id INT PRIMARY KEY, doctor_id INT, day_of_week CHAR(1), start_time TIME, end_time TIME, slot_minutes INT);
CREATE TABLE reservation (reservation_id INT PRIMARY KEY, patient_id INT, schedule_id INT, appointment_at TIMESTAMP);
CREATE TABLE encounter (encounter_id INT PRIMARY KEY, patient_id INT, doctor_id INT, reservation_id INT, admission_id INT,
                        encounter_at TIMESTAMP, encounter_type VARCHAR(10), finding VARCHAR(100));
CREATE TABLE admission (admission_id INT AUTO_INCREMENT PRIMARY KEY, decision_encounter_id INT NOT NULL UNIQUE REFERENCES encounter,
                        attending_id INT NOT NULL REFERENCES staff, room_no INT NOT NULL REFERENCES room,
                        admitted_at TIMESTAMP NOT NULL, expected_discharge_date DATE, discharged_at TIMESTAMP, reason VARCHAR(500) NOT NULL);
CREATE TABLE payment (payment_id INT PRIMARY KEY, encounter_id INT REFERENCES encounter, amount INT, status VARCHAR(10),
                      method VARCHAR(10), paid_at TIMESTAMP);
