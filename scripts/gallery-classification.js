/* Which collection each photo in assets/images/gallery-library belongs to.
   Assigned by looking at all 354 photos. Keyed by filename so adding or
   removing files never shifts an existing assignment.
   Edit this, then run: node scripts/build-gallery-data.mjs */
export const CLASSIFICATION = {
  "together": [
   "img-0395.jpg", "img-0396.jpg", "img-0397.jpg", "img-0399.jpg", "img-0516.jpg", "img-0517.jpg",
   "img-0518.jpg", "img-0521.jpg", "img-0522-2.jpg", "img-0522.jpg", "img-0525.jpg", "img-0527.jpg",
   "img-0543.jpg", "img-0544.jpg", "img-0546.jpg", "img-0547.jpg", "img-0551.jpg", "img-0558.jpg",
   "img-0572.jpg", "img-0573.jpg", "img-0575.jpg", "img-0577.jpg", "img-0691.jpg", "img-0698.jpg",
   "img-0821.jpg", "img-1148.jpg", "img-1149.jpg", "img-1151.jpg", "img-1190.jpg", "img-1192.jpg",
   "img-1206.jpg", "img-1209.jpg", "img-1457.jpg", "img-1458.jpg", "img-1459.jpg", "img-1461.jpg",
   "img-1471.jpg", "img-1477.jpg", "img-2183.jpg", "img-2195.jpg", "img-2198.jpg", "img-2218.jpg",
   "img-2219.jpg", "img-2221.jpg", "img-2222.jpg", "img-2226.jpg", "img-2227.jpg", "img-2274.jpg",
   "img-2275.jpg", "img-2276.jpg", "img-2277.jpg", "img-2278.jpg", "img-2281.jpg", "img-2284.jpg",
   "img-2285-2.jpg", "img-2285.jpg", "img-2286-2.jpg", "img-2286.jpg", "img-2287-2.jpg", "img-2287.jpg",
   "img-2288.jpg", "img-2525.jpg", "img-2527.jpg", "img-2532.jpg", "img-2533.jpg", "img-2534.jpg",
   "img-2535.jpg", "img-2539.jpg", "img-2671.jpg", "img-2674.jpg", "img-2675.jpg", "img-2678.jpg",
   "img-2707.jpg", "img-2711.jpg", "img-2726.jpg", "img-2728.jpg", "img-2729.jpg", "img-2811.jpg",
   "img-2812.jpg", "img-2814.jpg", "img-2921.jpg", "img-2922.jpg", "img-2923.jpg", "img-2927.jpg",
   "img-2928.jpg", "img-2933.jpg", "img-2938.jpg", "img-2939.jpg", "img-2940.jpg", "img-2941.jpg",
   "img-2942-2.jpg", "img-3527.jpg", "img-3581.jpg", "img-3637.jpg", "img-4198.jpg", "img-4206.jpg",
   "img-4207.jpg", "img-4208.jpg", "img-4486.jpg", "img-4487-2.jpg", "img-4491.jpg", "img-4784.jpg",
   "img-4785.jpg", "img-4786.jpg", "img-4788.jpg", "img-4790.jpg", "img-4791-2.jpg", "img-4794-2.jpg",
   "img-4796.jpg", "img-4797.jpg", "img-4802.jpg", "img-4834.jpg", "img-4835.jpg", "img-4836.jpg",
   "img-4838.jpg", "img-4839.jpg", "img-4840.jpg", "img-4847.jpg", "img-4850.jpg", "img_0551.jpg",
   "img_1190.jpg", "img_2198.jpg", "img_2274.jpg", "img_2927.jpg", "img_3527.jpg", "img_4031.jpg",
   "img_4207.jpg", "img_4784.jpg", "img_6474.jpg"
  ],
  "birthday": [
   "img-1966.jpg", "img-1967.jpg", "img-1968.jpg", "img-1971.jpg", "img-1972.jpg", "img-1973.jpg",
   "img-1978.jpg", "img-1979.jpg", "img-1980.jpg", "img-2731.jpg", "img-4477.jpg", "img-4487.jpg",
   "img_7157.jpg"
  ],
  "kids": [
   "img-2092.jpg", "img-2093.jpg", "img-2094.jpg", "img-2095.jpg", "img-2097.jpg", "img-2101.jpg",
   "img-2112.jpg", "img-2114.jpg", "img-2249.jpg", "img-2251.jpg", "img-3341.jpg", "img-3420.jpg",
   "img-4181.jpg", "img-4182.jpg", "img-4183.jpg", "img-4184.jpg"
  ],
  "team": [
   "img-2694.jpg", "img-2701.jpg", "img-2703.jpg", "img-2708.jpg", "img-2709.jpg", "img-3220.jpg",
   "img-3227.jpg", "img-3228.jpg", "img-3229.jpg", "img-3230.jpg", "img-3231.jpg", "img-3232.jpg",
   "img-3233.jpg", "img-3234.jpg", "img-3236.jpg", "img-3237.jpg", "img-3238.jpg", "img-3239.jpg",
   "img-3240.jpg", "img-3241.jpg", "img-3242.jpg", "img-3243.jpg", "img-3244.jpg", "img-3245.jpg",
   "img-3247.jpg", "img-3248.jpg", "img-3249.jpg", "img-3252.jpg", "img-3253.jpg", "img-3255.jpg",
   "img-3256.jpg", "img-4019.jpg", "img-4020.jpg", "img-4022.jpg", "img-4023.jpg", "img-4024.jpg",
   "img-4031.jpg", "img-4032.jpg", "img-4033.jpg", "img-4035.jpg", "img-4615.jpg", "img-4618.jpg",
   "img_2703.jpg", "img_3231.jpg"
  ],
  "bridal": [
   "img-3807.jpg", "img-3809.jpg", "img-3819.jpg", "img-3820.jpg", "img-3822.jpg", "img-3831.jpg",
   "img-3832.jpg", "img-3833.jpg", "img-3834.jpg", "img-3835.jpg"
  ],
  "pet": [
   "img-1274.jpg", "img-1275.jpg", "img-4780.jpg", "img-4791.jpg", "img-4792.jpg", "img-4793.jpg",
   "img-4794.jpg", "img-4795.jpg", "img_1275.jpg"
  ],
  "picnic": [
   "img-0592.jpg", "img-0604.jpg", "img-0608.jpg", "img-0609.jpg", "img-0610.jpg", "img-0611.jpg",
   "img-0612.jpg", "img-0614.jpg", "img-0618.jpg", "img-0620.jpg", "img-0621.jpg", "img-0622.jpg",
   "img-1469.jpg", "img-1472.jpg", "img_1469.jpg", "img_5945.jpg"
  ],
  "baby-shower": [
   "img-2942.jpg", "img-2946.jpg", "img-2950.jpg", "img-2951.jpg", "img-2952.jpg"
  ],
  "community": [
   "img-0372.jpg", "img-0374.jpg", "img-0375.jpg", "img-0383.jpg", "img-0386.jpg", "img-0387.jpg",
   "img-0388.jpg", "img-0389.jpg", "img-2165.jpg", "img-2167.jpg", "img-2179.jpg", "img-2180.jpg",
   "img-2703-2.jpg", "img-2704.jpg", "img-2706.jpg", "img-2708-2.jpg", "img-2730.jpg", "img-2731-2.jpg",
   "img-2732.jpg", "img-3908.jpg", "img-3910.jpg", "img-3912.jpg", "img-3913.jpg", "img-3915.jpg",
   "img-3919.jpg", "img-3920.jpg", "img-3924.jpg", "img-4485.jpg", "img-4489.jpg", "img-4492.jpg",
   "img-4688.jpg", "img-4692.jpg", "img-4694.jpg", "img-4695.jpg", "img-4696.jpg", "img-4697.jpg",
   "img-4699.jpg", "img-4700.jpg", "img-4702.jpg", "img-4704.jpg", "img-4849.jpg", "img-4992.jpg",
   "img-4994.jpg", "img_0374.jpg", "img_2167.jpg", "img_3912.jpg", "img_4688.jpg", "img_4992.jpg"
  ],
  "setup": [
   "img-0363.jpg", "img-0366.jpg", "img-0369.jpg", "img-0498.jpg", "img-0499.jpg", "img-0505.jpg",
   "img-0512.jpg", "img-1136.jpg", "img-1139.jpg", "img-1140.jpg", "img-1438.jpg", "img-1439.jpg",
   "img-1443.jpg", "img-1445.jpg", "img-1960.jpg", "img-1961.jpg", "img-2084.jpg", "img-2086.jpg",
   "img-2087.jpg", "img-2156.jpg", "img-2165-2.jpg", "img-2166.jpg", "img-2167-2.jpg", "img-2689.jpg",
   "img-2690.jpg", "img-2697.jpg", "img-2917.jpg", "img-2918.jpg", "img-3665.jpg", "img-3669.jpg",
   "img-3803.jpg", "img-4015.jpg", "img-4018.jpg", "img-4179.jpg", "img-4180.jpg", "img-4193.jpg",
   "img-4196.jpg", "img-4303.jpg", "img-4305.jpg", "img-4306.jpg", "img-4308.jpg", "img-4309.jpg",
   "img-4481.jpg", "img-4482.jpg", "img-4483.jpg", "img-4484.jpg", "img-4613.jpg", "img-4621.jpg",
   "img-4623.jpg", "img-4684.jpg", "img-4685.jpg", "img-4686.jpg", "img-4776.jpg", "img-4777.jpg",
   "img-4987.jpg", "img-4990.jpg", "img-4991.jpg", "img_0363.jpg", "img_0512.jpg", "img_1140.jpg",
   "img_1445.jpg", "img_2917.jpg", "img_4482.jpg", "img_5418.jpg"
  ],
};
