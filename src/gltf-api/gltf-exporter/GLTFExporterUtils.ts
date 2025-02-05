import {
	InterpolateLinear,
	PropertyBinding,
} from 'three';

export abstract class GLTFExporterUtils {

    public static insertKeyframe(track: any, time: any) {

        const tolerance = 0.001; // 1ms
        const valueSize = track.getValueSize();

        const times = new track.TimeBufferType(track.times.length + 1);
        const values = new track.ValueBufferType(track.values.length + valueSize);
        const interpolant = track.createInterpolant(new track.ValueBufferType(valueSize));

        let index;

        if (track.times.length === 0) {

            times[0] = time;

            for (let i = 0; i < valueSize; i++) {

                values[i] = 0;

            }

            index = 0;

        } else if (time < track.times[0]) {

            if (Math.abs(track.times[0] - time) < tolerance) return 0;

            times[0] = time;
            times.set(track.times, 1);

            values.set(interpolant.evaluate(time), 0);
            values.set(track.values, valueSize);

            index = 0;

        } else if (time > track.times[track.times.length - 1]) {

            if (Math.abs(track.times[track.times.length - 1] - time) < tolerance) {

                return track.times.length - 1;

            }

            times[times.length - 1] = time;
            times.set(track.times, 0);

            values.set(track.values, 0);
            values.set(interpolant.evaluate(time), track.values.length);

            index = times.length - 1;

        } else {

            for (let i = 0; i < track.times.length; i++) {

                if (Math.abs(track.times[i] - time) < tolerance) return i;

                if (track.times[i] < time && track.times[i + 1] > time) {

                    times.set(track.times.slice(0, i + 1), 0);
                    times[i + 1] = time;
                    times.set(track.times.slice(i + 1), i + 2);

                    values.set(track.values.slice(0, (i + 1) * valueSize), 0);
                    values.set(interpolant.evaluate(time), (i + 1) * valueSize);
                    values.set(track.values.slice((i + 1) * valueSize), (i + 2) * valueSize);

                    index = i + 1;

                    break;

                }

            }

        }

        track.times = times;
        track.values = values;

        return index;

    }

    public static mergeMorphTargetTracks(clip: any, root: any) {

        const tracks = [];
        const mergedTracks: Record<string, any> = {};
        const sourceTracks = clip.tracks;

        for (let i = 0; i < sourceTracks.length; ++i) {

            let sourceTrack = sourceTracks[i];
            const sourceTrackBinding = PropertyBinding.parseTrackName(sourceTrack.name);
            const sourceTrackNode = PropertyBinding.findNode(root, sourceTrackBinding.nodeName);

            if (sourceTrackBinding.propertyName !== 'morphTargetInfluences' || sourceTrackBinding.propertyIndex === undefined) {

                // Tracks that don't affect morph targets, or that affect all morph targets together, can be left as-is.
                tracks.push(sourceTrack);
                continue;

            }

            if (sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodDiscrete
                && sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodLinear) {

                if (sourceTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) {

                    // This should never happen, because glTF morph target animations
                    // affect all targets already.
                    throw new Error('THREE.GLTFExporter: Cannot merge tracks with glTF CUBICSPLINE interpolation.');

                }

                console.warn('THREE.GLTFExporter: Morph target interpolation mode not yet supported. Using LINEAR instead.');

                sourceTrack = sourceTrack.clone();
                sourceTrack.setInterpolation(InterpolateLinear);

            }

            const targetCount = sourceTrackNode.morphTargetInfluences.length;
            const targetIndex = sourceTrackNode.morphTargetDictionary[sourceTrackBinding.propertyIndex];

            if (targetIndex === undefined) {

                throw new Error('THREE.GLTFExporter: Morph target name not found: ' + sourceTrackBinding.propertyIndex);

            }

            let mergedTrack;

            // If this is the first time we've seen this object, create a new
            // track to store merged keyframe data for each morph target.
            if (mergedTracks[sourceTrackNode.uuid] === undefined) {

                mergedTrack = sourceTrack.clone();

                const values = new mergedTrack.ValueBufferType(targetCount * mergedTrack.times.length);

                for (let j = 0; j < mergedTrack.times.length; j++) {

                    values[j * targetCount + targetIndex] = mergedTrack.values[j];

                }

                // We need to take into consideration the intended target node
                // of our original un-merged morphTarget animation.
                mergedTrack.name = (sourceTrackBinding.nodeName || '') + '.morphTargetInfluences';
                mergedTrack.values = values;

                mergedTracks[sourceTrackNode.uuid] = mergedTrack;
                tracks.push(mergedTrack);

                continue;

            }

            const sourceInterpolant = sourceTrack.createInterpolant(new sourceTrack.ValueBufferType(1));

            mergedTrack = mergedTracks[sourceTrackNode.uuid];

            // For every existing keyframe of the merged track, write a (possibly
            // interpolated) value from the source track.
            for (let j = 0; j < mergedTrack.times.length; j++) {

                mergedTrack.values[j * targetCount + targetIndex] = sourceInterpolant.evaluate(mergedTrack.times[j]);

            }

            // For every existing keyframe of the source track, write a (possibly
            // new) keyframe to the merged track. Values from the previous loop may
            // be written again, but keyframes are de-duplicated.
            for (let j = 0; j < sourceTrack.times.length; j++) {

                const keyframeIndex = this.insertKeyframe(mergedTrack, sourceTrack.times[j])!;
                mergedTrack.values[keyframeIndex * targetCount + targetIndex] = sourceTrack.values[j];

            }
        }

        clip.tracks = tracks;

        return clip;

    }
};
