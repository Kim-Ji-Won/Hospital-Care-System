package com.hospital.backend.admission;

import com.hospital.backend.admission.controller.RoomStatusController;
import com.hospital.backend.admission.repository.RoomStatusRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.embedded.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RoomStatusApiTest {
    private EmbeddedDatabase db;
    private MockMvc mvc;
    private JdbcClient jdbc;

    @BeforeEach
    void setUp() {
        db = new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).build();
        jdbc = JdbcClient.create(db);
        jdbc.sql("CREATE TABLE room(room_no INT PRIMARY KEY, ward VARCHAR(20), bed_count INT, daily_fee INT)").update();
        jdbc.sql("CREATE TABLE admission(admission_id INT PRIMARY KEY, room_no INT, discharged_at TIMESTAMP)").update();
        jdbc.sql("INSERT INTO room VALUES (504,'6층',2,90000),(501,'5층',2,60000),(503,'5층',1,60000),(502,'5층',2,60000)").update();
        jdbc.sql("INSERT INTO admission VALUES (1,501,NULL),(2,501,CURRENT_TIMESTAMP),(3,503,NULL),(4,502,CURRENT_TIMESTAMP)").update();
        mvc = MockMvcBuilders.standaloneSetup(new RoomStatusController(new RoomStatusRepository(jdbc))).build();
    }

    @AfterEach
    void closeDatabase() {
        db.shutdown();
    }

    @Test
    void doctorGetsAllRoomsInNumberOrderWithOnlyActiveAdmissionsCounted() throws Exception {
        mvc.perform(get("/api/rooms").sessionAttr("role", "의사"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].roomNo").value(contains(501, 502, 503, 504)))
                .andExpect(jsonPath("$[*].occupiedBeds").value(contains(1, 0, 1, 0)))
                .andExpect(jsonPath("$[3].ward").value("6층"))
                .andExpect(jsonPath("$[3].bedCount").value(2))
                .andExpect(jsonPath("$[3].dailyFee").value(90000));
    }

    @Test
    void nurseCanFilterAvailabilityAndSeeNewlyDischargedBed() throws Exception {
        mvc.perform(get("/api/rooms?available=true").sessionAttr("role", "간호사"))
                .andExpect(jsonPath("$[*].roomNo").value(contains(501, 502, 504)));
        mvc.perform(get("/api/rooms?available=false").sessionAttr("role", "간호사"))
                .andExpect(jsonPath("$.length()").value(4));
        jdbc.sql("UPDATE admission SET discharged_at = CURRENT_TIMESTAMP WHERE admission_id = 3").update();
        mvc.perform(get("/api/rooms?available=true").sessionAttr("role", "간호사"))
                .andExpect(jsonPath("$[*].roomNo").value(contains(501, 502, 503, 504)));
    }

    @Test
    void emptyResultIsAnArray() throws Exception {
        jdbc.sql("DELETE FROM room WHERE room_no <> 503").update();
        mvc.perform(get("/api/rooms?available=true").sessionAttr("role", "의사"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void anonymousRequestCannotSupplyRoleInQuery() throws Exception {
        mvc.perform(get("/api/rooms?role=의사")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"원무", "환자"})
    void otherRolesCannotReadRooms(String role) throws Exception {
        mvc.perform(get("/api/rooms").sessionAttr("role", role)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void rejectsInvalidFilter() throws Exception {
        mvc.perform(get("/api/rooms?available=typo").sessionAttr("role", "의사")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields[0].field").value("available"));
    }
}
