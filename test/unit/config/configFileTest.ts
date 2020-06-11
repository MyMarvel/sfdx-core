/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as Path from 'path';

import { ConfigFile } from '../../../src/config/configFile';
import { shouldThrow, testSetup } from '../../../src/testSetup';
import { fs } from '../../../src/util/fs';

const $$ = testSetup();

class TestConfig extends ConfigFile<ConfigFile.Options> {
  public static async getTestLocalPath() {
    return $$.localPathRetriever(TestConfig.testId);
  }

  public static async getOptions(
    filename: string,
    isGlobal: boolean,
    isState?: boolean,
    filePath?: string
  ): Promise<ConfigFile.Options> {
    return {
      rootFolder: await $$.rootPathRetriever(isGlobal, TestConfig.testId),
      filename,
      isGlobal,
      isState,
      filePath
    };
  }

  public static getFileName() {
    return 'testFileName';
  }

  private static testId: string = $$.uniqid();
}

describe('Config', () => {
  describe('instantiation', () => {
    it('not using global has project dir', async () => {
      const config = await TestConfig.create(await TestConfig.getOptions('test', false));
      expect(config.getPath()).to.contain(await TestConfig.getTestLocalPath());
    });
    it('using global does not have project dir', async () => {
      const config = await TestConfig.create(await TestConfig.getOptions('test', true));
      expect(config.getPath()).to.not.contain(await TestConfig.getTestLocalPath());
    });
    it('using state folder for global even when state is set to false', async () => {
      const config = await TestConfig.create(await TestConfig.getOptions('test', true, false));
      expect(config.getPath()).to.not.contain(await TestConfig.getTestLocalPath());
      expect(config.getPath()).to.contain('.sfdx');
    });
    it('using local state folder', async () => {
      const config = await TestConfig.create(await TestConfig.getOptions('test', false, true));
      expect(config.getPath()).to.contain(await TestConfig.getTestLocalPath());
      expect(config.getPath()).to.contain('.sfdx');
    });
    it('using local file', async () => {
      const config = await TestConfig.create(await TestConfig.getOptions('test', false, false));
      expect(config.getPath()).to.contain(await TestConfig.getTestLocalPath());
      expect(config.getPath()).to.not.contain('.sfdx');
    });
    it('using local custom folder', async () => {
      const config = await TestConfig.create(
        await TestConfig.getOptions('test', false, false, Path.join('my', 'path'))
      );
      expect(config.getPath()).to.contain(await TestConfig.getTestLocalPath());
      expect(config.getPath()).to.not.contain('.sfdx');
      expect(config.getPath()).to.contain(Path.join('my', 'path', 'test'));
    });
  });

  describe('default options', () => {
    it('get applied with passed in options', async () => {
      // Pass in custom options
      const config = await TestConfig.create({ isState: true });
      // Creation doesn't fail with missing file name
      expect(config.getPath()).contains('testFileName');
    });
  });

  describe('read()', () => {
    let readJsonMapStub;
    let config: TestConfig;

    const testFileContents = {
      foo: 'bar'
    };

    beforeEach(async () => {
      $$.SANDBOXES.CONFIG.restore();
      readJsonMapStub = $$.SANDBOX.stub(fs, 'readJsonMap');
    });

    it('caches file contents', async () => {
      readJsonMapStub.callsFake(async () => testFileContents);
      // TestConfig.create() calls read()
      config = await TestConfig.create(await TestConfig.getOptions('test', false, true));
      expect(readJsonMapStub.calledOnce).to.be.true;

      // @ts-ignore -> hasRead is protected. Ignore for testing.
      expect(config.hasRead).to.be.true;
      expect(config.getContents()).to.deep.equal(testFileContents);

      // Read again.  Stub should still only be called once.
      const contents2 = await config.read(false, false);
      expect(readJsonMapStub.calledOnce).to.be.true;
      expect(contents2).to.deep.equal(testFileContents);
    });

    it('sets contents as empty object when file does not exist', async () => {
      const err = new Error();
      err['code'] = 'ENOENT';
      readJsonMapStub.throws(err);

      config = await TestConfig.create(await TestConfig.getOptions('test', false, true));
      expect(readJsonMapStub.calledOnce).to.be.true;

      // @ts-ignore -> hasRead is protected. Ignore for testing.
      expect(config.hasRead).to.be.true;
      expect(config.getContents()).to.deep.equal({});
    });

    it('throws when file does not exist and throwOnNotFound=true', async () => {
      const err = new Error('not here');
      err.name = 'FileNotFound';
      err['code'] = 'ENOENT';
      readJsonMapStub.throws(err);

      const configOptions = {
        filename: 'test',
        isGlobal: true,
        throwOnNotFound: true
      };

      try {
        await shouldThrow(TestConfig.create(configOptions));
      } catch (e) {
        expect(e).to.have.property('name', 'FileNotFound');
      }
    });

    it('sets hasRead=false by default', async () => {
      const configOptions = await TestConfig.getOptions('test', false, true);
      const testConfig = new TestConfig(configOptions);
      // @ts-ignore -> hasRead is protected. Ignore for testing.
      expect(testConfig.hasRead).to.be.false;
    });

    it('forces another read of the config file with force=true', async () => {
      readJsonMapStub.callsFake(async () => testFileContents);
      // TestConfig.create() calls read()
      config = await TestConfig.create(await TestConfig.getOptions('test', false, true));
      expect(readJsonMapStub.calledOnce).to.be.true;

      // @ts-ignore -> hasRead is protected. Ignore for testing.
      expect(config.hasRead).to.be.true;
      expect(config.getContents()).to.deep.equal(testFileContents);

      // Read again.  Stub should now be called twice.
      const contents2 = await config.read(false, true);
      expect(readJsonMapStub.calledTwice).to.be.true;
      expect(contents2).to.deep.equal(testFileContents);
    });
  });
});
