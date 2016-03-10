import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from nn import f

# open random image of dimensions 639x516
img = Image.open(open('../data/Lenna.png'))
# dimensions are (height, width, channel)
img = np.asarray(img, dtype='float64') / 256.

# put image in 4D tensor of shape (1, 3, height, width)
img_ = img.transpose(2, 0, 1).reshape(1, 3, 512, 512)

filtered_img = f(img_)


# Plotting

fig = plt.figure()

a = fig.add_subplot(1,3,1)
plt.imshow(img)
a.set_title("Original")

fig.add_subplot(1,3,2)
plt.imshow(filtered_img[0, 0, :, :])

fig.add_subplot(1,3,3)
plt.imshow(filtered_img[0, 1, :, :])

plt.show()





