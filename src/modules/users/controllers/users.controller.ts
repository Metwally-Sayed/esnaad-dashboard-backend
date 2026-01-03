import { Request, Response, NextFunction } from 'express';
import { UsersService } from '../services/users.service';
import { successResponse } from '../../../common/utils/response';
import { GetUsersQueryDto, UpdateUserDto } from '../dto/users.dto';

export class UsersController {
  private usersService: UsersService;

  constructor() {
    this.usersService = new UsersService();
  }

  getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: GetUsersQueryDto = req.query;
      const result = await this.usersService.getUsers(query, req.user!);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = await this.usersService.getUserById(id, req.user!);
      res.json(successResponse({ user }));
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data: UpdateUserDto = req.body;
      const user = await this.usersService.updateUser(id, data, req.user!);
      res.json(successResponse({ user }, 'User updated successfully'));
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.usersService.deleteUser(id, req.user!);
      res.json(successResponse(null, 'User deleted successfully'));
    } catch (error) {
      next(error);
    }
  };
}
