package com.hospital.backend.payment;

import com.hospital.backend.payment.controller.PaymentCollectionController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.contains;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:collection;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=none"})
@Sql("/payment/collection-fixture.sql")
class PaymentCollectionApiTest {
    @Autowired PaymentCollectionController controller;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void clerkSeesSortedHistoryWithRoundsAndWithoutDoubleCountingCancelledBill() throws Exception {
        mvc.perform(get("/api/payments?patientId=1").sessionAttr("role", "원무"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].paymentId").value(contains(32,31,30)))
                .andExpect(jsonPath("$[0].billingType").value("외래"))
                .andExpect(jsonPath("$[0].admission").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$[1].admission.roomNo").value(501))
                .andExpect(jsonPath("$[1].departmentName").value("내과"))
                .andExpect(jsonPath("$[1].includes.examNames").value(contains("X선","혈액검사")))
                .andExpect(jsonPath("$[1].includes.inHousePrescriptionCount").value(1))
                .andExpect(jsonPath("$[1].includes.hasOutsidePrescription").value(true))
                .andExpect(jsonPath("$[1].includes.admissionDays").value(1))
                .andExpect(jsonPath("$[2].includes.roundCount").value(1));
    }

    @Test
    void mineUsesSessionIdentityEvenIfQueryNamesAnotherPatient() throws Exception {
        mvc.perform(get("/api/me/payments?patientId=1").sessionAttr("role","환자").sessionAttr("patientId",2))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].paymentId").value(contains(40)));
    }

    @Test
    void emptyListAndMissingPatientAreDistinct() throws Exception {
        mvc.perform(get("/api/payments?patientId=3").sessionAttr("role","원무"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/payments?patientId=99").sessionAttr("role","원무"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(get("/api/payments").sessionAttr("role","원무"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields[0].field").value("patientId"));
    }

    @Test
    void requiresSessionAndCorrectRole() throws Exception {
        mvc.perform(get("/api/payments?patientId=1&role=원무")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/payments?patientId=1").sessionAttr("role","간호사")).andExpect(status().isForbidden());
        mvc.perform(get("/api/me/payments").sessionAttr("role","원무")).andExpect(status().isForbidden());
        mvc.perform(post("/api/payments/31/pay").sessionAttr("role","의사")).andExpect(status().isForbidden());
        mvc.perform(post("/api/payments/31/pay")).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings={"카드","현금","계좌이체"})
    void payKeepsStoredAmountAndReturnsUpdatedPayment(String method) throws Exception {
        mvc.perform(post("/api/payments/31/pay").sessionAttr("role","원무")
                        .contentType("application/json").content("{\"method\":\"" + method + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("완료"))
                .andExpect(jsonPath("$.method").value(method)).andExpect(jsonPath("$.amount").value(78000))
                .andExpect(jsonPath("$.paidAt").isString());
        mvc.perform(get("/api/me/payments").sessionAttr("role","환자").sessionAttr("patientId",1))
                .andExpect(jsonPath("$[1].status").value("완료"));
    }

    @Test
    void rejectsInvalidMethodUnknownBillAndCancelledBill() throws Exception {
        mvc.perform(post("/api/payments/31/pay").sessionAttr("role","원무")
                        .contentType("application/json").content("{\"method\":\"기타\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields[0].field").value("method"));
        mvc.perform(post("/api/payments/999/pay").sessionAttr("role","원무")
                        .contentType("application/json").content("{\"method\":\"카드\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/payments/30/pay").sessionAttr("role","원무")
                        .contentType("application/json").content("{\"method\":\"카드\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_STATUS"));
    }

    @Test
    void concurrentPaymentsOnlyOneSucceeds() throws Exception {
        var start = new CyclicBarrier(2);
        Callable<Integer> pay = () -> {
            start.await(5, TimeUnit.SECONDS);
            return mvc.perform(post("/api/payments/31/pay").sessionAttr("role","원무")
                    .contentType("application/json").content("{\"method\":\"카드\"}")).andReturn().getResponse().getStatus();
        };
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(pay);
            var second = pool.submit(pay);
            assertEquals(List.of(200,409), List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))
                    .stream().sorted().toList());
        }
    }
}
