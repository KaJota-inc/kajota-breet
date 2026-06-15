package com.kajota.kajota_mobile_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Standalone Spring Boot app for demoing the KaJota × Breet integration
 * end-to-end without dragging in the production backend's Mongo / AWS /
 * Stripe dependencies.
 *
 * <p>The classes under {@code controller/breet}, {@code service/breet},
 * {@code util/breet}, and {@code model/dto/...breet} are the same files
 * shipped in the {@code hackathon/breet} branch of the production
 * backend — they're mirrored here so the demo provably runs the
 * production wiring, not a separate fork.</p>
 *
 * <p>Boot with:
 * <pre>
 *   export BREET_WEBHOOK_SECRET=demo-secret-do-not-use-in-prod
 *   mvn spring-boot:run
 * </pre>
 * The app listens on :9082 by default — same port as the production
 * backend, so the SUBMISSION.md curl one-liner works unchanged.</p>
 */
@SpringBootApplication
public class BreetDemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(BreetDemoApplication.class, args);
    }
}
