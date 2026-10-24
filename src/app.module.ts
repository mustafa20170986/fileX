import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UplaodController } from './uplaod/uplaod.controller';
import { UplaodModule } from './uplaod/uplaod.module';

@Module({
  imports: [UplaodModule],
  controllers: [AppController, UplaodController],
  providers: [AppService],
})
export class AppModule {}
