package com.hospital.backend.admission;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:admission_assignment;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.sql.init.schema-locations=classpath:admission/assignment-schema.sql"
})
@Sql("/admission/assignment-fixture.sql")
class AdmissionAssignmentApiTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcClient jdbc;
    @Autowired JsonMapper json;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void listsOnlyPendingOutpatientsInDecisionTimeOrder() throws Exception {
        mvc.perform(get("/api/admissions/pending").sessionAttr("role", "의사"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].decisionEncounterId", contains(102, 101, 103)))
                .andExpect(jsonPath("$[0].decidedAt").value("2026-01-02T09:00:00"))
                .andExpect(jsonPath("$[0].doctorId").value(11)).andExpect(jsonPath("$[0].doctorName").value("결정의"))
                .andExpect(jsonPath("$[0].departmentName").value("내과"))
                .andExpect(jsonPath("$[0].patient.name").value("환자둘"))
                .andExpect(jsonPath("$[0].patient.birthDate").value("1980-02-03"))
                .andExpect(jsonPath("$[0].patient.gender").value("남"));
    }

    @Test
    void nurseAssignsAvailableBedAndDifferentAttendingAndRemovesDecisionFromQueue() throws Exception {
        var body = request(101, 501);
        body.put("reason", "  경과 관찰  ");
        assign(body).andExpect(status().isCreated())
                .andExpect(jsonPath("$.admissionId").isNumber()).andExpect(jsonPath("$.patient.patientId").value(1))
                .andExpect(jsonPath("$.decisionEncounterId").value(101)).andExpect(jsonPath("$.attendingId").value(12))
                .andExpect(jsonPath("$.attendingName").value("담당의")).andExpect(jsonPath("$.roomNo").value(501))
                .andExpect(jsonPath("$.ward").value("5층")).andExpect(jsonPath("$.reason").value("경과 관찰"))
                .andExpect(jsonPath("$.admittedAt").isString()).andExpect(jsonPath("$.expectedDischargeDate", nullValue()))
                .andExpect(jsonPath("$.dischargedAt", nullValue()));
        mvc.perform(get("/api/admissions/pending").sessionAttr("role", "간호사"))
                .andExpect(jsonPath("$[*].decisionEncounterId", contains(102, 103)));
        assertEquals(0, jdbc.sql("SELECT COUNT(*) FROM payment WHERE encounter_id=101 AND status <> '취소'")
                .query(Integer.class).single());
        assign(body).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_STATUS"));
    }

    @Test
    void acceptsTodayInKoreaAndFiveHundredCharacterReason() throws Exception {
        String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
        var body = request(101, 501).put("expectedDischargeDate", today).put("reason", "가".repeat(500));
        mvc.perform(post("/api/admissions").sessionAttr("role", "의사").contentType("application/json").content(body.toString()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.expectedDischargeDate").value(today));
    }

    @ParameterizedTest
    @ValueSource(strings = {"환자", "원무"})
    void rejectsUnauthorizedRolesOnBothRoutes(String role) throws Exception {
        mvc.perform(get("/api/admissions/pending").sessionAttr("role", role))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(post("/api/admissions").sessionAttr("role", role).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void bothRoutesRequireSession() throws Exception {
        mvc.perform(get("/api/admissions/pending?role=의사")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(post("/api/admissions").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"decisionEncounterId", "roomNo", "attendingId", "reason"})
    void missingRequiredFieldIsReported(String field) throws Exception {
        var body = request(101, 501);
        body.remove(field);
        invalid(body, field);
    }

    @Test
    void rejectsBlankOrLongReasonPastOrMalformedDateAndNonDoctor() throws Exception {
        invalid(request(101, 501).put("reason", "  "), "reason");
        invalid(request(101, 501).put("reason", "가".repeat(501)), "reason");
        invalid(request(101, 501).put("expectedDischargeDate", "2000-01-01"), "expectedDischargeDate");
        invalid(request(101, 501).put("expectedDischargeDate", "잘못된 날짜"), "expectedDischargeDate");
        invalid(request(101, 501).put("attendingId", 13), "attendingId");
        assertEquals(0, activeCount());
    }

    @ParameterizedTest
    @ValueSource(strings = {"decisionEncounterId", "roomNo", "attendingId"})
    void returnsNotFoundForUnknownReference(String field) throws Exception {
        assign(request(101, 501).put(field, 999)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @ParameterizedTest
    @ValueSource(ints = {104, 105, 106, 107})
    void rejectsBilledOutpatientsPastDecisionAndRound(int encounterId) throws Exception {
        assign(request(encounterId, 501)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"));
    }

    @Test
    void alreadyAdmittedIncludesExistingAdmissionDetails() throws Exception {
        var first = assign(request(101, 501)).andExpect(status().isCreated()).andReturn().getResponse();
        var existing = json.readTree(first.getContentAsByteArray());
        assign(request(103, 502)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_ADMITTED"))
                .andExpect(jsonPath("$.details.admissionId").value(existing.get("admissionId").asInt()))
                .andExpect(jsonPath("$.details.roomNo").value(501))
                .andExpect(jsonPath("$.details.admittedAt").value(existing.get("admittedAt").asString()));
    }

    @ParameterizedTest
    @CsvSource({"102,501,ROOM_FULL", "103,502,ALREADY_ADMITTED", "101,502,INVALID_STATUS"})
    void concurrentAssignmentsHaveOneWinner(int otherEncounter, int otherRoom, String expectedConflict) throws Exception {
        var start = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> race(start, 101, 501));
            var second = pool.submit(() -> race(start, otherEncounter, otherRoom));
            var outcomes = List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
            assertEquals(1, outcomes.stream().filter("201"::equals).count());
            assertEquals(1, outcomes.stream().filter(("409 " + expectedConflict)::equals).count());
        }
        assertEquals(1, activeCount());
    }

    private String race(CyclicBarrier start, int decision, int room) throws Exception {
        start.await(5, TimeUnit.SECONDS);
        var response = assign(request(decision, room)).andReturn().getResponse();
        if (response.getStatus() == 201) return "201";
        return response.getStatus() + " " + json.readTree(response.getContentAsByteArray()).path("code").asString();
    }

    private int activeCount() {
        return jdbc.sql("SELECT COUNT(*) FROM admission WHERE discharged_at IS NULL").query(Integer.class).single();
    }

    private ObjectNode request(int encounter, int room) {
        return json.createObjectNode().put("decisionEncounterId", encounter).put("roomNo", room)
                .put("attendingId", 12).put("reason", "경과 관찰");
    }

    private ResultActions assign(ObjectNode body) throws Exception {
        return mvc.perform(post("/api/admissions").sessionAttr("role", "간호사")
                .contentType("application/json").content(body.toString()));
    }

    private void invalid(ObjectNode body, String field) throws Exception {
        assign(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fields[0].field").value(field));
    }
}
