import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller({ path: 'stores/:storeId/categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a category in a store' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateCategoryDto,
    @Req() req: Request,
  ) {
    return this.categoriesService.create(user.userId, storeId, dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List categories for a store' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListCategoriesQueryDto,
  ) {
    return this.categoriesService.list(user.userId, storeId, query);
  }

  @Get(':categoryId')
  @ApiOperation({ summary: 'Get a category by id' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.categoriesService.getOne(user.userId, storeId, categoryId);
  }

  @Patch(':categoryId')
  @ApiOperation({ summary: 'Update a category' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: Request,
  ) {
    return this.categoriesService.update(
      user.userId,
      storeId,
      categoryId,
      dto,
      req,
    );
  }

  @Delete(':categoryId')
  @ApiOperation({ summary: 'Delete a category (rejects if children or products exist)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Req() req: Request,
  ) {
    return this.categoriesService.remove(user.userId, storeId, categoryId, req);
  }
}
