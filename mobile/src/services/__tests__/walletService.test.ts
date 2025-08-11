import { WalletService } from '../walletService';

describe('WalletService', () => {
  let walletService: WalletService;

  beforeEach(() => {
    walletService = new WalletService();
  });

  afterEach(async () => {
    await walletService.disconnect();
  });

  describe('initializeApi', () => {
    it('should initialize mock API successfully', async () => {
      await walletService.initializeApi();
      expect(walletService.getApi()).toEqual({ isReady: true });
    });
  });

  describe('detectWalletExtensions', () => {
    it('should return mock wallet extensions', async () => {
      const result = await walletService.detectWalletExtensions();
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Nova Wallet',
        version: '1.0.0',
        isNovaWallet: true,
      });
    });
  });

  describe('connectWallet', () => {
    it('should connect wallet successfully with mock accounts', async () => {
      const result = await walletService.connectWallet();

      expect(result.success).toBe(true);
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts![0].address).toBe('1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg');
      expect(result.accounts![0].meta.name).toBe('Test Account');
      expect(result.accounts![0].meta.source).toBe('Nova Wallet');
    });
  });

  describe('getSigner', () => {
    it('should get mock signer for account successfully', async () => {
      const result = await walletService.getSigner('1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg');

      expect(result).toHaveProperty('signPayload');
      expect(result).toHaveProperty('signRaw');
      
      const signResult = await result.signPayload({});
      expect(signResult.signature).toBe('mock-signature');
    });
  });

  describe('isValidPolkadotAddress', () => {
    it('should validate correct Polkadot address format', () => {
      const validAddress = '1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg';
      expect(walletService.isValidPolkadotAddress(validAddress)).toBe(true);
    });

    it('should reject invalid address length', () => {
      const invalidAddress = '1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24f'; // Too short
      expect(walletService.isValidPolkadotAddress(invalidAddress)).toBe(false);
    });

    it('should reject address not starting with 1', () => {
      const invalidAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'; // Starts with 5
      expect(walletService.isValidPolkadotAddress(invalidAddress)).toBe(false);
    });

    it('should handle empty string', () => {
      expect(walletService.isValidPolkadotAddress('')).toBe(false);
    });
  });

  describe('isWalletAvailable', () => {
    it('should return true for mock wallet', async () => {
      const result = await walletService.isWalletAvailable();
      expect(result).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and reset state', async () => {
      await walletService.initializeApi();
      await walletService.disconnect();
      expect(walletService.getApi()).toBeNull();
    });
  });
});