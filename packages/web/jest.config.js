const defaultConfig = require('../../jest.config.js')

module.exports = {
  ...defaultConfig,
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsConfig: 'tsconfig.jest.json',
    },
  },
  moduleNameMapper: {
    '\\.(png|jpg|jpeg)$': '<rootDir>/__mocks__/ImageStub.ts',
    'src/(.*)$': '<rootDir>/src/$1',
  },
  preset: 'react-native-web',
  testEnvironment: 'node',
}
