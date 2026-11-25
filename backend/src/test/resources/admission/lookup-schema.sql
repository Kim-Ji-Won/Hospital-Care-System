CREATE TABLE exam_item (exam_code VARCHAR(10) PRIMARY KEY, name VARCHAR(100), category VARCHAR(10), fee INT);
CREATE TABLE exam (exam_id INT PRIMARY KEY, encounter_id INT REFERENCES encounter, exam_code VARCHAR(10) REFERENCES exam_item, requested_at TIMESTAMP);
CREATE TABLE prescription (prescription_id INT PRIMARY KEY, encounter_id INT REFERENCES encounter, dispense_type VARCHAR(10), prescribed_at TIMESTAMP);
