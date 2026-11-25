package com.hospital.backend.admission;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:admission_lookup;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.sql.init.schema-locations=classpath:admission/assignment-schema.sql,classpath:admission/lookup-schema.sql"
})
@Sql({"/admission/assignment-fixture.sql", "/admission/lookup-fixture.sql"})
@Sql(statements = {"DELETE FROM exam", "DELETE FROM prescription", "DELETE FROM exam_item"},
        executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class AdmissionLookupApiTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcClient jdbc;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/admissions", "/api/admissions?current=true"})
    void listsCurrentAdmissionsOldestFirst(String path) throws Exception {
        mvc.perform(get(path).sessionAttr("role", "간호사"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].admissionId", contains(20, 10)))
                .andExpect(jsonPath("$[0].expectedDischargeDate", nullValue()))
                .andExpect(jsonPath("$[1].dischargedAt", nullValue()))
                .andExpect(jsonPath("$[1].patient.patientId").value(1))
                .andExpect(jsonPath("$[1].patient.name").value("환자하나"))
                .andExpect(jsonPath("$[1].decisionEncounterId").value(101))
                .andExpect(jsonPath("$[1].attendingName").value("담당의"))
                .andExpect(jsonPath("$[1].roomNo").value(501))
                .andExpect(jsonPath("$[1].expectedDischargeDate").value("2026-01-10"));
    }

    @Test
    void includesDischargedAdmissionsWhenRequested() throws Exception {
        mvc.perform(get("/api/admissions?current=false").sessionAttr("role", "의사"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].admissionId", contains(1, 20, 10)))
                .andExpect(jsonPath("$[0].dischargedAt").value("2026-01-01T16:00:00"));
    }

    @Test
    void returnsEmptyArrayWhenNobodyIsAdmitted() throws Exception {
        jdbc.sql("UPDATE admission SET discharged_at = CURRENT_TIMESTAMP WHERE discharged_at IS NULL").update();
        mvc.perform(get("/api/admissions").sessionAttr("role", "의사"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void detailCountsOnlyOrdersFromThisStayAndSortsRoundsNewestFirst() throws Exception {
        mvc.perform(get("/api/admissions/10").sessionAttr("role", "의사"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.admissionId").value(10)).andExpect(jsonPath("$.patient.name").value("환자하나"))
                .andExpect(jsonPath("$.admittedAt").value("2026-01-03T10:00:00")).andExpect(jsonPath("$.ward").value("5층"))
                .andExpect(jsonPath("$.reason").value("경과 관찰"))
                .andExpect(jsonPath("$.rounds[*].encounterId", contains(202, 201)))
                .andExpect(jsonPath("$.rounds[0].encounterAt").value("2026-01-05T10:00:00"))
                .andExpect(jsonPath("$.rounds[0].finding").value("호전"))
                .andExpect(jsonPath("$.rounds[1].doctorId").value(11))
                .andExpect(jsonPath("$.rounds[1].doctorName").value("결정의"))
                .andExpect(jsonPath("$.summary.roundCount").value(2))
                .andExpect(jsonPath("$.summary.examCount").value(3))
                .andExpect(jsonPath("$.summary.inHousePrescriptionCount").value(2));
    }

    @Test
    void newAdmissionHasEmptyRoundsAndZeroCounts() throws Exception {
        mvc.perform(get("/api/admissions/20").sessionAttr("role", "간호사"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rounds").isEmpty())
                .andExpect(jsonPath("$.summary.roundCount").value(0)).andExpect(jsonPath("$.summary.examCount").value(0))
                .andExpect(jsonPath("$.summary.inHousePrescriptionCount").value(0));
    }

    @Test
    void dischargedAdmissionRemainsReadable() throws Exception {
        mvc.perform(get("/api/admissions/1").sessionAttr("role", "간호사"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.dischargedAt").value("2026-01-01T16:00:00"))
                .andExpect(jsonPath("$.rounds[*].encounterId", contains(107)));
    }

    @Test
    void unknownAdmissionReturnsCommonNotFound() throws Exception {
        mvc.perform(get("/api/admissions/999").sessionAttr("role", "의사"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void invalidArgumentsUseCommonValidationResponse() throws Exception {
        mvc.perform(get("/api/admissions?current=no").sessionAttr("role", "의사"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields[0].field").value("current"));
        mvc.perform(get("/api/admissions/abc").sessionAttr("role", "의사"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields[0].field").value("admissionId"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/admissions", "/api/admissions/10"})
    void onlyClinicalStaffCanReadAdmissions(String path) throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        for (String role : new String[]{"환자", "원무"}) {
            mvc.perform(get(path).sessionAttr("role", role)).andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
    }
}
