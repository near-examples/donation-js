const SEED = Cypress.env('seed')

context("Main Page", () => {
    beforeEach(() => {
        cy.visit("/");
    });

    it("should display home page correctly", () => {
        // should display the title
        cy.get("h4").contains("Latest Donations");
        // should have columns titled: "User" and "Total Donated Ⓝ"
        cy.get("th").contains("User");
        cy.get("th").contains("Total Donated Ⓝ");
        // should have a button to Sign in
        cy.get("button").contains("Sign in");
    });

    it("should be able to complete donation flow", () => {
        // should be able to click on the Sign in button
        cy.get("button").contains("Sign in").click();
        // Select element from left modal list titled: "MyNearWallet" and click on it
        cy.get("div").contains("MyNearWallet").click();
        // Wait for new page to load
        cy.wait(5000);
        // Click on the "Import Existing Account" button
        cy.get("button").contains("Import Existing Account").click();
        // Click on the "Recover Account" button
        cy.get("button").contains("Recover Account").click();
        // Fill in SEED from the environment variable into the input field
        cy.get("input").type(SEED);
        // Click on the "Find My Account" button
        cy.get("button").contains("Find My Account").click();
        // Wait for new page to load
        cy.wait(10000);
        // Click on the "Next" button
        cy.get("button").contains("Next").click();
        // Click on the "Connect" button
        cy.get("button").contains("Connect").click();
        // Wait for new page to load
        cy.wait(10000);

        // should be able to enter the amount to donate
        cy.get("input#donation").type("10");
        // should be able to click the donate button
        cy.get("button").contains("Donate").click();
        // should be able to click "Approve" to confirm the donation
        cy.get("button").contains("Approve").click();
        // should display an on-screen notification that the donation was successful with message: "Thank you! You have donated so far:"
        cy.get("div").contains("Thank you! You have donated so far:");
        // should display the donation among the list of donations
        cy.get("td").contains("10");
    });
});