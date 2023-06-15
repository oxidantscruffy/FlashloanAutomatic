const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const utils = web3.utils;
const { getCreated } = require('./helpers/utils');

const { expect } = require('chai');

const Archangel = artifacts.require('Archangel');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const Fountain = artifacts.require('Fountain');
const FountainFactory = artifacts.require('FountainFactory');
const SimpleToken = artifacts.require('SimpleToken');

contract('Archangel', function([_, user, owner]) {
  beforeEach(async function() {
    this.archangel = await Archangel.new(new BN('9'), { from: owner });
    const angelFactory = await this.archangel.angelFactory.call();
    const fountainFactory = await this.archangel.fountainFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fountainFactory = await FountainFactory.at(fountainFactory);
    this.token1 = await SimpleToken.new('Staking', 'STK', ether('1000000000'));
    this.token2 = await SimpleToken.new('Reward', 'RWD', ether('1000000000'));
  });

  describe('Get fountain', function() {
    beforeEach(async function() {
      await this.fountainFactory.create(this.token1.address);
    });

    it('created', async function() {
      expect(
        await this.archangel.getFountain.call(this.token1.address)
      ).to.not.equal(ZERO_ADDRESS);
    });

    it('not created', async function() {
      expect(await this.archangel.getFountain.call(this.token2.address)).equal(
        ZERO_ADDRESS
      );
    });
  });

  describe('Set default fee', function() {
    let oldRate;
    const newRate = new BN('200');
    beforeEach(async function() {
      oldRate = await this.archangel.defaultFlashLoanFee.call();
    });

    it('normal', async function() {
      const oldAngel = await getCreated(
        await this.angelFactory.create(this.token2.address),
        Angel
      );
      await this.archangel.setDefaultFlashLoanFee(newRate, { from: owner });
      const newAngel = await getCreated(
        await this.angelFactory.create(this.token2.address),
        Angel
      );
      expect(
        await this.archangel.defaultFlashLoanFee.call()
      ).to.be.bignumber.eq(newRate);
      expect(await oldAngel.flashLoanFee.call()).to.be.bignumber.eq(oldRate);
      expect(await newAngel.flashLoanFee.call()).to.be.bignumber.eq(newRate);
    });

    it('from not owner', async function() {
      const oldAngel = await getCreated(
        await this.angelFactory.create(this.token2.address),
        Angel
      );
      await expectRevert(
        this.archangel.setDefaultFlashLoanFee(newRate),
        'caller is not the owner'
      );
      const newAngel = await getCreated(
        await this.angelFactory.create(this.token2.address),
        Angel
      );
      expect(
        await this.archangel.defaultFlashLoanFee.call()
      ).to.be.bignumber.eq(oldRate);
      expect(await oldAngel.flashLoanFee.call()).to.be.bignumber.eq(oldRate);
      expect(await newAngel.flashLoanFee.call()).to.be.bignumber.eq(oldRate);
    });

    it('rate too high', async function() {
      const oldAngel = await getCreated(
        await this.angelFactory.create(this.token2.address),
        Angel
      );
      await expectRevert(
        this.archangel.setDefaultFlashLoanFee(new BN('10001'), { from: owner }),
        'fee rate exceeded'
      );
      const newAngel = await getCreated(
        await this.angelFactory.create(this.token2.address),
        Angel
      );
      expect(
        await this.archangel.defaultFlashLoanFee.call()
      ).to.be.bignumber.eq(oldRate);
      expect(await oldAngel.flashLoanFee.call()).to.be.bignumber.eq(oldRate);
      expect(await newAngel.flashLoanFee.call()).to.be.bignumber.eq(oldRate);
    });
  });

  describe('Set fee', function() {
    beforeEach(async function() {
      this.fountain = await getCreated(
        await this.fountainFactory.create(this.token1.address),
        Fountain
      );
      this.angel = await getCreated(
        await this.angelFactory.create(this.token2.address),
        Angel
      );
    });

    it('from owner', async function() {
      const fee = new BN('50');
      await this.archangel.setFlashLoanFee(this.fountain.address, fee, {
        from: owner,
      });
      await this.archangel.setFlashLoanFee(this.angel.address, fee, {
        from: owner,
      });
      expect(await this.fountain.flashLoanFee.call()).to.be.bignumber.eq(fee);
      expect(await this.angel.flashLoanFee.call()).to.be.bignumber.eq(fee);
    });

    it('not from owner', async function() {
      const fee = new BN('50');
      await expectRevert(
        this.archangel.setFlashLoanFee(this.fountain.address, fee),
        'caller is not the owner'
      );
    });

    it('fee rate exceeded', async function() {
      const fee = new BN('50000');
      await expectRevert(
        this.archangel.setFlashLoanFee(this.fountain.address, fee, {
          from: owner,
        }),
        'fee rate exceeded'
      );
    });
  });
});
