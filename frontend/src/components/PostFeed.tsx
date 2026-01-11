interface PostFeedProps {
  userId: string;
}

export default function PostFeed({ userId }: PostFeedProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Posts</h3>
      <p className="text-gray-600 text-center py-8">
        No posts yet. Check back later!
      </p>
    </div>
  );
}
