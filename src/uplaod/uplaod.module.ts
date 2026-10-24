import { Module } from '@nestjs/common';
import { UplaodController } from './uplaod.controller';
import { RustFSService } from 'src/rfs.service';
@Module({
  controllers: [UplaodController],
  providers: [RustFSService],
  exports: [RustFSService],
})
export class UplaodModule {}
