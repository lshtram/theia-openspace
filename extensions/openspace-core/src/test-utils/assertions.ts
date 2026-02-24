import { expect as chaiExpect } from 'chai';

export const expect = chaiExpect;

export function expectSuccessResult(result: unknown): void {
    const value = result as { success?: unknown; error?: unknown };
    expect(value.success).to.equal(true);
    expect(value.error).to.be.undefined;
}

export function expectErrorResult(result: unknown): void {
    const value = result as { success?: unknown; error?: unknown };
    expect(value.success).to.equal(false);
    expect(value.error).to.be.a('string').and.to.have.length.greaterThan(0);
}
