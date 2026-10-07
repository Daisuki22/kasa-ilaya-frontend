import React, { useEffect, useState } from 'react';
import { baseClient } from '@/api/baseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, Loader2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { optimizeImageFile } from '@/lib/optimizeImageFile';

const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;
const REVIEW_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function LeaveReviewDialog({ booking, open, onClose, onSubmitted }) {
	const [rating, setRating] = useState(5);
	const [reviewText, setReviewText] = useState('');
	const [reviewImage, setReviewImage] = useState(null);
	const [reviewImagePreview, setReviewImagePreview] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploadingImage, setIsUploadingImage] = useState(false);

	useEffect(() => {
		if (open) {
			setRating(5);
			setReviewText('');
			setReviewImage(null);
			setIsSubmitting(false);
			setIsUploadingImage(false);
		}
	}, [open, booking?.id]);

	useEffect(() => {
		if (!reviewImage) {
			setReviewImagePreview('');
			return undefined;
		}

		const previewUrl = URL.createObjectURL(reviewImage);
		setReviewImagePreview(previewUrl);
		return () => URL.revokeObjectURL(previewUrl);
	}, [reviewImage]);

	const handleImageChange = (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;

		if (!REVIEW_IMAGE_TYPES.has(file.type)) {
			toast.error('Choose a JPG, PNG, or WebP image.');
			return;
		}
		if (file.size > MAX_REVIEW_IMAGE_BYTES) {
			toast.error('Review image must be 5 MB or smaller.');
			return;
		}

		setReviewImage(file);
	};

	const handleSubmit = async () => {
		if (!booking || !reviewText.trim()) {
			return;
		}

		setIsSubmitting(true);

		try {
			let imageUrl;
			if (reviewImage) {
				setIsUploadingImage(true);
				const optimizedImage = await optimizeImageFile(reviewImage, 1200);
				const upload = await baseClient.integrations.Core.UploadFile({
					file: optimizedImage,
					purpose: 'review_image',
				});
				if (!upload?.file_url) throw new Error('Unable to upload the review image. Please try again.');
				imageUrl = upload.file_url;
				setIsUploadingImage(false);
			}

			await baseClient.entities.Review.create({
				booking_id: booking.id,
				booking_reference: booking.booking_reference,
				guest_name: booking.customer_name,
				guest_email: booking.customer_email,
				package_name: booking.package_name,
				rating,
				review_text: reviewText.trim(),
				...(imageUrl ? { image_url: imageUrl } : {}),
			});
			toast.success('Your review is now visible in the resort review section.');
			if (onSubmitted) {
				onSubmitted();
				return;
			}
			onClose();
		} catch (error) {
			toast.error(error?.message || 'Unable to submit your review.');
		} finally {
			setIsUploadingImage(false);
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Leave a Review</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<p className="text-sm font-medium text-foreground">{booking?.package_name}</p>
						<p className="text-sm text-muted-foreground">Share your experience with other guests.</p>
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">Your Rating</p>
						<div className="flex gap-2">
							{[1, 2, 3, 4, 5].map((value) => (
								<button
									key={value}
									type="button"
									className="rounded-md p-1 transition-colors hover:bg-muted"
									onClick={() => setRating(value)}
								>
									<Star className={value <= rating ? 'h-6 w-6 fill-secondary text-secondary' : 'h-6 w-6 text-muted-foreground'} />
								</button>
							))}
						</div>
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">Review</p>
						<Textarea
							value={reviewText}
							onChange={(event) => setReviewText(event.target.value)}
							placeholder="Tell us what you liked, what stood out, and how your stay went."
							rows={5}
						/>
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">Photo <span className="font-normal text-muted-foreground">(optional)</span></p>
						{reviewImagePreview ? (
							<div className="relative w-fit max-w-full">
								<img src={reviewImagePreview} alt="Review photo preview" className="max-h-48 max-w-full rounded-md border object-contain" />
								<Button
									type="button"
									variant="secondary"
									size="icon"
									className="absolute right-2 top-2 h-8 w-8"
									aria-label="Remove review photo"
									onClick={() => setReviewImage(null)}
									disabled={isSubmitting}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						) : (
							<label className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
								<ImagePlus className="h-4 w-4" />
								<span>Add a photo</span>
								<Input
									type="file"
									accept="image/jpeg,image/png,image/webp"
									className="sr-only"
									onChange={handleImageChange}
									disabled={isSubmitting}
								/>
							</label>
						)}
						<p className="text-xs text-muted-foreground">JPG, PNG, or WebP, up to 5 MB.</p>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting || !reviewText.trim()}>
						{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						{isUploadingImage ? 'Uploading photo...' : isSubmitting ? 'Submitting...' : 'Submit Review'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
