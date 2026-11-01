import api from './api';
import type {
  Product,
  Category,
  CreateProductRequest,
  AvailabilityBlock,
  PaginatedResponse,
} from '@/types';

export interface ProductFilters {
  search?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  condition?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
  owner?: string;
}

export const productService = {
  async listProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    const res = await api.get('/products/', { params: filters });
    return res.data;
  },

  async getProduct(id: string): Promise<Product> {
    const res = await api.get(`/products/${id}/`);
    return res.data;
  },

  async createProduct(data: CreateProductRequest): Promise<Product> {
    const res = await api.post('/products/', data);
    return res.data;
  },

  async updateProduct(id: string, data: Partial<CreateProductRequest>): Promise<Product> {
    const res = await api.patch(`/products/${id}/`, data);
    return res.data;
  },

  async deleteProduct(id: string): Promise<void> {
    await api.delete(`/products/${id}/`);
  },

  async uploadProductImage(
    productId: string,
    uri: string,
    isPrimary = false,
    mimeType = 'image/jpeg',
  ): Promise<{ id: string; image: string }> {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'image.jpg';
    formData.append('image', { uri, name: filename, type: mimeType } as unknown as Blob);
    formData.append('is_primary', String(isPrimary));

    const res = await api.post(`/products/${productId}/images/`, formData);
    return res.data;
  },

  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    await api.delete(`/products/${productId}/images/${imageId}/`);
  },

  async getMyListings(): Promise<Product[]> {
    const res = await api.get('/products/my-listings/');
    return res.data;
  },

  async getAvailability(productId: string): Promise<AvailabilityBlock[]> {
    const res = await api.get(`/products/${productId}/availability/`);
    return res.data;
  },

  async blockDates(
    productId: string,
    startDate: string,
    endDate: string,
  ): Promise<AvailabilityBlock> {
    const res = await api.post(`/products/${productId}/availability/`, {
      start_date: startDate,
      end_date: endDate,
      block_type: 'owner_blocked',
    });
    return res.data;
  },

  async unblockDates(productId: string, blockId: string): Promise<void> {
    await api.delete(`/products/${productId}/availability/${blockId}/`);
  },

  async listCategories(): Promise<Category[]> {
    const res = await api.get('/categories/');
    return res.data;
  },

  async createCategory(data: {
    name: string;
    icon_name?: string;
    sort_order?: number;
    parent?: string | null;
  }): Promise<Category> {
    const res = await api.post('/categories/', data);
    return res.data;
  },

  async updateCategory(
    id: string,
    data: { name?: string; icon_name?: string; sort_order?: number },
  ): Promise<Category> {
    const res = await api.patch(`/categories/${id}/`, data);
    return res.data;
  },

  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/categories/${id}/`);
  },
};
