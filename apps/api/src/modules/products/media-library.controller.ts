import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { MEDIA_PURPOSES, PRODUCT_IMAGE_MAX_BYTES, type MediaPurpose } from './product-image.util';
import { MediaLibraryService, type UploadedImageFile } from './media-library.service';

class ListMediaQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

function parsePurpose(value: string | undefined): MediaPurpose {
  const purpose = (value ?? 'general') as MediaPurpose;
  if (!MEDIA_PURPOSES.includes(purpose)) {
    throw new BadRequestException(`purpose must be one of: ${MEDIA_PURPOSES.join(', ')}`);
  }
  return purpose;
}

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/media', version: '1' })
export class MediaLibraryController {
  constructor(private readonly media: MediaLibraryService) {}

  @Get()
  @ApiOperation({ summary: 'List the store’s media gallery (newest first)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListMediaQueryDto,
  ) {
    return this.media.list(user.userId, storeId, query);
  }

  @Post()
  @ApiOperation({
    summary:
      'Upload an image to the gallery (multipart field "file"; JPEG, PNG or WebP, ≤ 1.5 MB). ' +
      'Query purpose=logo|favicon|background|product|general adds that use’s checks (favicon: square).',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES, files: 1, fields: 0 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('purpose') purpose: string | undefined,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ) {
    return this.media.upload(user.userId, storeId, file, parsePurpose(purpose), req);
  }

  @Delete(':mediaId')
  @ApiOperation({ summary: 'Delete a gallery image that is not used anywhere in the store' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Req() req: Request,
  ) {
    return this.media.remove(user.userId, storeId, mediaId, req);
  }
}
