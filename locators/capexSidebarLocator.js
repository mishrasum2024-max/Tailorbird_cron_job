function capexSidebarLocators(page) {
    return {
        propertyDropdown: page.getByRole('button', { name: /Select a Property|name_|Sample Property|Test Property|Westerham/i }).first(),
        propertySearchInput: page.getByRole('textbox', { name: /Search properties\.\.\./i }).first(),
        propertyMenuItems: page.getByRole('menuitem'),
        yearDropdown: page.getByRole('textbox', { name: /\d{4}/ }).first(),
        gridSearchInput: page.getByPlaceholder(/Search/i).first(),

        columnHeaders: page.locator('[role="columnheader"]'),
        gridRows: page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }),
        gridCells: page.locator('[role="gridcell"]'),
        treeExpandButtons: page.locator('[role="row"] button[aria-expanded], [role="gridcell"] button[aria-expanded]'),

        budgetCategoryHeader: page.getByRole('columnheader', { name: 'Budget Category' }),
        categoryHeader: page.getByRole('columnheader', { name: 'Category' }),
        originalBudgetHeader: page.getByRole('columnheader', { name: 'Original Budget' }),
        budgetRevisionHeader: page.getByRole('columnheader', { name: 'Budget Revision' }),
        currentBudgetHeader: page.getByRole('columnheader', { name: 'Current Budget' }),
        budgetRemainingHeader: page.getByRole('columnheader', { name: 'Budget Remaining' }),
        originalContractHeader: page.getByRole('columnheader', { name: 'Original Contract Amount' }),
        approvedCOHeader: page.getByRole('columnheader', { name: 'Approved Change Orders' }),
        currentContractHeader: page.getByRole('columnheader', { name: 'Current Contract Amount' }),
        remainingContractHeader: page.getByRole('columnheader', { name: 'Remaining Contract Amount' }),
        invoicedAmountHeader: page.getByRole('columnheader', { name: 'Invoiced Amount' }),
    };
}

module.exports = { capexSidebarLocators };
