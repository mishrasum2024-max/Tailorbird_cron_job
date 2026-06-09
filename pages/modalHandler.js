class ModalHandler {
  constructor(page) {
    this.page = page;
  }

  /**
   * Generic reusable method for Add Data modal
   */
  async addData({ nameInputLocator, descInputLocator, typeButtonsLocator, submitButtonLocator, name, description }) {
    // Fill inputs
    await nameInputLocator.fill(name);
    console.log(`🖊️ Filled Name Input with: ${name}`);
    await descInputLocator.fill(description);
    console.log(`🖊️ Filled Description Input with: ${description}`) ;

    // Random type selection
    const typeButtons = await typeButtonsLocator.elementHandles();
    const randomIndex = Math.floor(Math.random() * typeButtons.length);
    await typeButtons[randomIndex].click();
    console.log(`🔘 Selected Type Button at index: ${randomIndex}`);

    // Submit
    await submitButtonLocator.waitFor({ state: 'visible' });
    await submitButtonLocator.click();
    console.log(`✅ Clicked Submit Button to add data.`);
    
    await this.page.waitForTimeout(3000);
    console.log(`Data added successfully.`);
  }
}

module.exports = ModalHandler;
