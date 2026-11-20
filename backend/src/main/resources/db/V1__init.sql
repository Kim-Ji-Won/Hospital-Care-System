-- 병원 예약·진료 관리 시스템 스키마 (테이블정의서 수정본 2026-11-18 기준, 17개 테이블)
-- MySQL 8.0.16 이상 (함수형 UNIQUE·CHECK)
-- 실행: mysql -u root -p hospital < V1__init.sql
-- 규칙: 이미 적용된 이 파일은 고치지 않는다. 변경은 V2__설명.sql 로 추가한다.
-- 모든 FK는 ON DELETE RESTRICT. '규칙'(앱에서 검사하는 것)은 여기 넣지 않는다.

-- Windows mysql 클라이언트는 기본이 UTF-8이 아니라 한글 ENUM이 '?'로 깨짐
SET NAMES utf8mb4;

-- ───────── 참조 테이블 ─────────

CREATE TABLE department (
    department_code VARCHAR(10)  NOT NULL,
    name            VARCHAR(50)  NOT NULL,
    location        VARCHAR(100) NULL,
    phone           VARCHAR(20)  NULL,
    CONSTRAINT pk_department PRIMARY KEY (department_code)
);

CREATE TABLE disease (
    disease_code VARCHAR(10)  NOT NULL,
    name         VARCHAR(100) NOT NULL,
    CONSTRAINT pk_disease PRIMARY KEY (disease_code)
);

CREATE TABLE drug (
    drug_code  VARCHAR(10)  NOT NULL,
    name       VARCHAR(100) NOT NULL,
    ingredient VARCHAR(100) NULL,
    form       VARCHAR(20)  NOT NULL,
    unit       VARCHAR(20)  NOT NULL,
    unit_price INT          NOT NULL,
    CONSTRAINT pk_drug PRIMARY KEY (drug_code)
);

CREATE TABLE exam_item (
    exam_code       VARCHAR(10)                 NOT NULL,
    name            VARCHAR(100)                NOT NULL,
    category        ENUM('혈액','영상','기능')  NOT NULL,
    reference_range VARCHAR(50)                 NULL,
    unit            VARCHAR(20)                 NULL,
    fee             INT                         NOT NULL,
    CONSTRAINT pk_exam_item PRIMARY KEY (exam_code)
);

CREATE TABLE room (
    room_no   INT         NOT NULL,
    ward      VARCHAR(20) NOT NULL,
    bed_count INT         NOT NULL,
    daily_fee INT         NOT NULL,
    CONSTRAINT pk_room PRIMARY KEY (room_no),
    CONSTRAINT ck_room_bed_count CHECK (bed_count > 0)
);

-- ───────── 환자·의료진 ─────────

CREATE TABLE patient (
    patient_id    INT               NOT NULL AUTO_INCREMENT,
    name          VARCHAR(50)       NOT NULL,
    birth_date    DATE              NOT NULL,
    gender        ENUM('남','여')   NOT NULL,
    phone         VARCHAR(20)       NOT NULL,
    address       VARCHAR(200)      NULL,
    blood_type    VARCHAR(10)       NULL,
    login_id      VARCHAR(20)       NULL,
    password_hash VARCHAR(255)      NULL,
    CONSTRAINT pk_patient PRIMARY KEY (patient_id),
    CONSTRAINT uk_patient_login_id UNIQUE (login_id)
);

CREATE TABLE staff (
    staff_id        INT                              NOT NULL AUTO_INCREMENT,
    department_code VARCHAR(10)                      NULL,  -- 원무는 NULL, 의사·간호사는 필수(앱 규칙)
    name            VARCHAR(50)                      NOT NULL,
    phone           VARCHAR(20)                      NOT NULL,
    job_type        ENUM('의사','간호사','원무')     NOT NULL,
    position        VARCHAR(20)                      NULL,
    login_id        VARCHAR(20)                      NOT NULL,
    password_hash   VARCHAR(255)                     NOT NULL,
    CONSTRAINT pk_staff PRIMARY KEY (staff_id),
    CONSTRAINT uk_staff_login_id UNIQUE (login_id),
    CONSTRAINT fk_staff_department FOREIGN KEY (department_code)
        REFERENCES department (department_code) ON DELETE RESTRICT
);

-- ───────── 예약·진료 ─────────

CREATE TABLE schedule (
    schedule_id  INT                                       NOT NULL AUTO_INCREMENT,
    doctor_id    INT                                       NOT NULL,
    day_of_week  ENUM('월','화','수','목','금','토','일')  NOT NULL,
    start_time   TIME                                      NOT NULL,
    end_time     TIME                                      NOT NULL,
    slot_minutes INT                                       NOT NULL,
    CONSTRAINT pk_schedule PRIMARY KEY (schedule_id),
    CONSTRAINT fk_schedule_doctor FOREIGN KEY (doctor_id)
        REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT ck_schedule_time CHECK (start_time < end_time),
    CONSTRAINT ck_schedule_slot CHECK (slot_minutes > 0)
);

CREATE TABLE day_off (
    day_off_id  INT          NOT NULL AUTO_INCREMENT,
    schedule_id INT          NOT NULL,
    off_date    DATE         NOT NULL,
    reason      VARCHAR(200) NULL,
    CONSTRAINT pk_day_off PRIMARY KEY (day_off_id),
    CONSTRAINT uk_day_off_schedule_date UNIQUE (schedule_id, off_date),
    CONSTRAINT fk_day_off_schedule FOREIGN KEY (schedule_id)
        REFERENCES schedule (schedule_id) ON DELETE RESTRICT
);

CREATE TABLE reservation (
    reservation_id INT                                  NOT NULL AUTO_INCREMENT,
    patient_id     INT                                  NOT NULL,
    schedule_id    INT                                  NOT NULL,
    appointment_at DATETIME                             NOT NULL,
    status         ENUM('예약','취소','완료','노쇼')    NOT NULL DEFAULT '예약',
    created_at     DATETIME                             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    symptom_note   VARCHAR(500)                         NULL,
    CONSTRAINT pk_reservation PRIMARY KEY (reservation_id),
    CONSTRAINT fk_reservation_patient FOREIGN KEY (patient_id)
        REFERENCES patient (patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservation_schedule FOREIGN KEY (schedule_id)
        REFERENCES schedule (schedule_id) ON DELETE RESTRICT,
    -- 취소되지 않은 예약은 같은 일정·같은 일시에 1건, 같은 환자·같은 일시에 1건
    CONSTRAINT uk_reservation_schedule_at UNIQUE ((IF(status = '취소', NULL, schedule_id)), appointment_at),
    CONSTRAINT uk_reservation_patient_at  UNIQUE ((IF(status = '취소', NULL, patient_id)),  appointment_at)
);

-- encounter ↔ admission 이 서로를 참조하므로 encounter.admission_id FK는 admission 생성 뒤 ALTER로 추가
CREATE TABLE encounter (
    encounter_id   INT                   NOT NULL AUTO_INCREMENT,
    patient_id     INT                   NOT NULL,
    doctor_id      INT                   NOT NULL,
    reservation_id INT                   NULL,  -- 외래는 필수
    admission_id   INT                   NULL,  -- 회진은 필수
    encounter_at   DATETIME              NOT NULL,
    encounter_type ENUM('외래','입원')   NOT NULL,
    symptom        TEXT                  NULL,
    finding        TEXT                  NOT NULL,
    CONSTRAINT pk_encounter PRIMARY KEY (encounter_id),
    CONSTRAINT uk_encounter_reservation UNIQUE (reservation_id),
    CONSTRAINT fk_encounter_patient FOREIGN KEY (patient_id)
        REFERENCES patient (patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_encounter_doctor FOREIGN KEY (doctor_id)
        REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_encounter_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservation (reservation_id) ON DELETE RESTRICT,
    CONSTRAINT ck_encounter_link CHECK ((reservation_id IS NULL) <> (admission_id IS NULL)),
    CONSTRAINT ck_encounter_type CHECK ((encounter_type = '외래') = (reservation_id IS NOT NULL))
);

CREATE TABLE diagnosis (
    encounter_id INT         NOT NULL,
    disease_code VARCHAR(10) NOT NULL,
    is_primary   CHAR(1)     NOT NULL,
    CONSTRAINT pk_diagnosis PRIMARY KEY (encounter_id, disease_code),
    CONSTRAINT fk_diagnosis_encounter FOREIGN KEY (encounter_id)
        REFERENCES encounter (encounter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_diagnosis_disease FOREIGN KEY (disease_code)
        REFERENCES disease (disease_code) ON DELETE RESTRICT,
    CONSTRAINT ck_diagnosis_is_primary CHECK (is_primary IN ('Y','N'))
);

-- ───────── 처방·검사 ─────────

CREATE TABLE prescription (
    prescription_id INT                   NOT NULL AUTO_INCREMENT,
    encounter_id    INT                   NOT NULL,
    prescribed_at   DATETIME              NOT NULL,
    dispense_type   ENUM('원내','원외')   NOT NULL,
    CONSTRAINT pk_prescription PRIMARY KEY (prescription_id),
    CONSTRAINT fk_prescription_encounter FOREIGN KEY (encounter_id)
        REFERENCES encounter (encounter_id) ON DELETE RESTRICT
);

CREATE TABLE prescription_item (
    prescription_id INT           NOT NULL,
    drug_code       VARCHAR(10)   NOT NULL,
    dose            DECIMAL(6,2)  NOT NULL,
    times_per_day   INT           NOT NULL,
    duration_days   INT           NOT NULL,
    instruction     VARCHAR(100)  NOT NULL,
    CONSTRAINT pk_prescription_item PRIMARY KEY (prescription_id, drug_code),
    CONSTRAINT fk_prescription_item_prescription FOREIGN KEY (prescription_id)
        REFERENCES prescription (prescription_id) ON DELETE RESTRICT,
    CONSTRAINT fk_prescription_item_drug FOREIGN KEY (drug_code)
        REFERENCES drug (drug_code) ON DELETE RESTRICT,
    CONSTRAINT ck_prescription_item_dose CHECK (dose > 0),
    CONSTRAINT ck_prescription_item_times CHECK (times_per_day > 0),
    CONSTRAINT ck_prescription_item_days CHECK (duration_days > 0)
);

CREATE TABLE exam (
    exam_id      INT                          NOT NULL AUTO_INCREMENT,
    encounter_id INT                          NOT NULL,
    exam_code    VARCHAR(10)                  NOT NULL,
    reader_id    INT                          NULL,
    requested_at DATETIME                     NOT NULL,
    performed_at DATETIME                     NULL,
    status       ENUM('요청','시행','완료')   NOT NULL DEFAULT '요청',
    result_value DECIMAL(10,2)                NULL,
    result_flag  ENUM('정상','이상')          NULL,
    reading_note TEXT                         NULL,
    CONSTRAINT pk_exam PRIMARY KEY (exam_id),
    CONSTRAINT fk_exam_encounter FOREIGN KEY (encounter_id)
        REFERENCES encounter (encounter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exam_item FOREIGN KEY (exam_code)
        REFERENCES exam_item (exam_code) ON DELETE RESTRICT,
    CONSTRAINT fk_exam_reader FOREIGN KEY (reader_id)
        REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT ck_exam_performed CHECK (status = '요청' OR performed_at IS NOT NULL),
    CONSTRAINT ck_exam_completed CHECK (status <> '완료'
        OR (result_flag IS NOT NULL AND reading_note IS NOT NULL AND reader_id IS NOT NULL))
);

-- ───────── 입·퇴원 ─────────

CREATE TABLE admission (
    admission_id            INT          NOT NULL AUTO_INCREMENT,
    decision_encounter_id   INT          NOT NULL,
    attending_id            INT          NOT NULL,
    room_no                 INT          NOT NULL,
    admitted_at             DATETIME     NOT NULL,
    expected_discharge_date DATE         NULL,
    discharged_at           DATETIME     NULL,
    reason                  VARCHAR(500) NOT NULL,
    CONSTRAINT pk_admission PRIMARY KEY (admission_id),
    CONSTRAINT uk_admission_decision_encounter UNIQUE (decision_encounter_id),
    CONSTRAINT fk_admission_decision_encounter FOREIGN KEY (decision_encounter_id)
        REFERENCES encounter (encounter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_admission_attending FOREIGN KEY (attending_id)
        REFERENCES staff (staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_admission_room FOREIGN KEY (room_no)
        REFERENCES room (room_no) ON DELETE RESTRICT
);

ALTER TABLE encounter
    ADD CONSTRAINT fk_encounter_admission FOREIGN KEY (admission_id)
        REFERENCES admission (admission_id) ON DELETE RESTRICT;

-- ───────── 결제 ─────────

CREATE TABLE payment (
    payment_id   INT                                NOT NULL AUTO_INCREMENT,
    encounter_id INT                                NOT NULL,
    amount       INT                                NOT NULL,
    created_at   DATETIME                           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    method       ENUM('카드','현금','계좌이체')     NULL,
    status       ENUM('미결제','완료','취소')       NOT NULL DEFAULT '미결제',
    paid_at      DATETIME                           NULL,
    CONSTRAINT pk_payment PRIMARY KEY (payment_id),
    CONSTRAINT fk_payment_encounter FOREIGN KEY (encounter_id)
        REFERENCES encounter (encounter_id) ON DELETE RESTRICT,
    -- 진료마다 '취소'가 아닌 결제는 1건
    CONSTRAINT uk_payment_active UNIQUE ((IF(status = '취소', NULL, encounter_id))),
    CONSTRAINT ck_payment_paid CHECK (status = '미결제' OR (method IS NOT NULL AND paid_at IS NOT NULL))
);
