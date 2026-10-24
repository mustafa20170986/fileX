import { Test, TestingModule } from '@nestjs/testing';
import { UplaodController } from './uplaod.controller';

describe('UplaodController', () => {
  let controller: UplaodController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UplaodController],
    }).compile();

    controller = module.get<UplaodController>(UplaodController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
