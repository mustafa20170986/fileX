import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RustFSService } from 'src/rfs.service';
import { presignedDTO } from 'src/dto/fileval.dto';
@Controller('uplaod')
export class UplaodController {
  constructor(private readonly rustfs: RustFSService) {}
  @Post('initial')
  @HttpCode(HttpStatus.OK)
  async getpresignedurl(@Body() dto: presignedDTO) {
    const result = await this.rustfs.initialmultipart(
      dto.filename,
      dto.filetype,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  async getpresigned(
    @Body() body: { filekey: string; uploadId: string; totalpart: number },
  ) {
    const result = await this.rustfs.presignedpaart(
      body.filekey,
      body.uploadId,
      body.totalpart,
    );
    return { success: true, data: result };
  }
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async returnurlafterupload(
    @Body()
    body: {
      filekey: string;
      uploadId: string;
      parts: { partnumber: number; etag: string }[];
    },
  ) {
    const result = await this.rustfs.completeupload(
      body.filekey,
      body.uploadId,
      body.parts,
    );
    return {
      success: true,
      data: result,
    };
  }
  @Post('abort')
  @HttpCode(HttpStatus.OK)
  async abortupload(@Body() body: { filekey: string; upalodId: string }) {
    const result = await this.rustfs.abortcancelmultipart(
      body.filekey,
      body.upalodId,
    );
    return {
      success: true,
      data: result,
    };
  }
}
