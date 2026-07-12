import { prisma } from '../lib/prisma';

export async function recalculateCampgroundRatings(campgroundId: string): Promise<void> {
  const result = await prisma.campgroundReview.aggregate({
    where: { campgroundId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.campground.update({
    where: { id: campgroundId },
    data: {
      averageRating: result._avg.rating || 0,
      ratingCount: result._count.rating || 0,
    },
  });
}
