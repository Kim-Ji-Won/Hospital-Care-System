DROP ALL OBJECTS;
CREATE TABLE encounter (encounter_id INT PRIMARY KEY, encounter_type VARCHAR(10) NOT NULL);
CREATE TABLE exam_item (exam_code VARCHAR(10) PRIMARY KEY, fee INT NOT NULL);
CREATE TABLE exam (encounter_id INT, exam_code VARCHAR(10), status VARCHAR(10));
CREATE TABLE drug (drug_code VARCHAR(10) PRIMARY KEY, unit_price INT);
CREATE TABLE prescription (prescription_id INT PRIMARY KEY, encounter_id INT, dispense_type VARCHAR(10));
CREATE TABLE prescription_item (prescription_id INT, drug_code VARCHAR(10), dose DECIMAL(6,2), times_per_day INT, duration_days INT);
CREATE TABLE payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL REFERENCES encounter(encounter_id),
    amount INT NOT NULL,
    status VARCHAR(10) DEFAULT '미결제' NOT NULL,
    method VARCHAR(10), paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active_encounter INT GENERATED ALWAYS AS (CASE WHEN status <> '취소' THEN encounter_id END),
    UNIQUE (active_encounter)
);
INSERT INTO encounter VALUES (1, '외래'), (2, '외래'), (3, '입원');
INSERT INTO exam_item VALUES ('X', 8000);
INSERT INTO exam VALUES (1, 'X', '요청'), (1, 'X', '시행'), (2, 'X', '완료');
INSERT INTO drug VALUES ('D', 945);
INSERT INTO prescription VALUES (10, 1, '원내'), (11, 1, '원외'), (12, 2, '원내');
INSERT INTO prescription_item VALUES (10, 'D', 0.50, 1, 1), (11, 'D', 2.00, 3, 5), (12, 'D', 1.00, 1, 1);
